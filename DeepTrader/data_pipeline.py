import snowflake.connector
import pandas as pd
import numpy as np
import ta
from sklearn.preprocessing import StandardScaler
from typing import Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

from config import SNOWFLAKE_CONFIG, DATA_CONFIG

class DataPipeline:
    def __init__(self):
        self.scaler = StandardScaler()
        
    def connect_to_snowflake(self):
        """Connect to Snowflake database"""
        try:
            conn = snowflake.connector.connect(**SNOWFLAKE_CONFIG)
            print("✅ Successfully connected to Snowflake")
            return conn
        except Exception as e:
            print(f"❌ Failed to connect to Snowflake: {e}")
            return None
    
    def import_data_from_snowflake(self, save_raw_csv: bool = True) -> pd.DataFrame:
        """Import data from Snowflake and save raw CSV"""
        conn = self.connect_to_snowflake()
        if conn is None:
            return None
            
        query = """
        SELECT 
            UNIX_TIMESTAMP,
            OPEN,
            HIGH,
            CLOSE,
            LOW,
            VOLUME_TO as VOLUME
        FROM BTC_HOURLY_DATA
        ORDER BY UNIX_TIMESTAMP ASC
        """
        
        try:
            df = pd.read_sql(query, conn)
            print(f"✅ Successfully imported {len(df):,} rows from Snowflake")
            
            if save_raw_csv:
                df.to_csv('data/raw_btc_data.csv', index=False)
                print("✅ Raw data saved to data/raw_btc_data.csv")
                
            return df
        except Exception as e:
            print(f"❌ Failed to import data: {e}")
            return None
        finally:
            conn.close()
    
    def add_technical_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add powerful technical indicators using ta library"""
        print("🔧 Adding technical indicators...")
        
        # Price-based indicators
        df['sma_20'] = ta.trend.SMAIndicator(close=df['CLOSE'], window=20).sma_indicator()
        df['ema_12'] = ta.trend.EMAIndicator(close=df['CLOSE'], window=12).ema_indicator()
        df['ema_26'] = ta.trend.EMAIndicator(close=df['CLOSE'], window=26).ema_indicator()
        
        # MACD
        macd = ta.trend.MACD(close=df['CLOSE'])
        df['macd'] = macd.macd()
        df['macd_signal'] = macd.macd_signal()
        df['macd_diff'] = macd.macd_diff()
        
        # RSI
        df['rsi'] = ta.momentum.RSIIndicator(close=df['CLOSE'], window=14).rsi()
        
        # Bollinger Bands
        bb = ta.volatility.BollingerBands(close=df['CLOSE'])
        df['bb_high'] = bb.bollinger_hband()
        df['bb_low'] = bb.bollinger_lband()
        df['bb_width'] = bb.bollinger_wband()
        
        # Stochastic Oscillator
        stoch = ta.momentum.StochasticOscillator(high=df['HIGH'], low=df['LOW'], close=df['CLOSE'])
        df['stoch_k'] = stoch.stoch()
        df['stoch_d'] = stoch.stoch_signal()
        
        # Volume indicators (simplified)
        df['volume_sma'] = df['VOLUME'].rolling(window=20).mean()  # Simple volume moving average
        mfi = ta.volume.MFIIndicator(high=df['HIGH'], low=df['LOW'], close=df['CLOSE'], volume=df['VOLUME'])
        df['mfi'] = mfi.money_flow_index()
        
        # Volatility indicators
        atr = ta.volatility.AverageTrueRange(high=df['HIGH'], low=df['LOW'], close=df['CLOSE'])
        df['atr'] = atr.average_true_range()
        
        # Price ratios and returns
        df['price_change'] = df['CLOSE'].pct_change()
        df['high_low_ratio'] = df['HIGH'] / df['LOW']
        df['close_open_ratio'] = df['CLOSE'] / df['OPEN']
        
        print("✅ Technical indicators added successfully")
        return df
    
    def add_volatility_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add 30-day volatility features"""
        print("📊 Adding volatility features...")
        
        window = DATA_CONFIG['volatility_window']
        
        # Rolling volatility (30 days)
        df['volatility_30d'] = df['price_change'].rolling(window=window).std() * np.sqrt(24)  # Annualized hourly volatility
        
        # Rolling price volatility
        df['price_volatility_30d'] = df['CLOSE'].rolling(window=window).std()
        
        # High-Low volatility
        df['hl_volatility_30d'] = ((df['HIGH'] - df['LOW']) / df['CLOSE']).rolling(window=window).mean()
        
        print("✅ Volatility features added successfully")
        return df
    
    def preprocess_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Complete preprocessing pipeline"""
        print("🚀 Starting data preprocessing...")
        
        # Convert timestamp to datetime for reference
        df['datetime'] = pd.to_datetime(df['UNIX_TIMESTAMP'], unit='s')
        
        # Add technical indicators
        df = self.add_technical_indicators(df)
        
        # Add volatility features
        df = self.add_volatility_features(df)
                
        # Remove rows with NaN values (from technical indicators)
        initial_length = len(df)
        df = df.dropna()
        final_length = len(df)
        
        print(f"✅ Preprocessing complete. Dataset: {initial_length:,} → {final_length:,} rows")
        return df
    
    def save_preprocessed_data(self, df: pd.DataFrame, filename: str = 'data/preprocessed_btc_data.csv'):
        """Save preprocessed data to CSV"""
        # Create data directory if it doesn't exist
        import os
        os.makedirs('data', exist_ok=True)
        
        df.to_csv(filename, index=False)
        print(f"✅ Preprocessed data saved to {filename}")
        
    def load_preprocessed_data(self, filename: str = 'data/preprocessed_btc_data.csv') -> Optional[pd.DataFrame]:
        """Load preprocessed data from CSV"""
        try:
            df = pd.read_csv(filename)
            df['datetime'] = pd.to_datetime(df['datetime'])
            print(f"✅ Loaded preprocessed data: {len(df):,} rows")
            return df
        except FileNotFoundError:
            print(f"❌ File {filename} not found. Please run data preprocessing first.")
            return None
    
    def prepare_features_for_model(self, df: pd.DataFrame) -> Tuple[np.ndarray, list]:
        """Prepare features for the DQN model"""
        # Select relevant features for the model
        feature_columns = [
            'OPEN', 'HIGH', 'LOW', 'CLOSE', 'VOLUME',
            'sma_20', 'ema_12', 'ema_26', 'macd', 'macd_signal', 'macd_diff',
            'rsi', 'bb_high', 'bb_low', 'bb_width', 'stoch_k', 'stoch_d',
            'volume_sma', 'mfi', 'atr', 'price_change', 'high_low_ratio', 
            'close_open_ratio', 'volatility_30d', 'price_volatility_30d', 'hl_volatility_30d'
        ]
        
        # Filter columns that exist in the dataframe
        available_features = [col for col in feature_columns if col in df.columns]
        
        features = df[available_features].values
        
        print(f"✅ Prepared {len(available_features)} features for model")
        return features, available_features

if __name__ == "__main__":
    # Example usage
    pipeline = DataPipeline()
    
    # Import and preprocess data
    raw_data = pipeline.import_data_from_snowflake()
    if raw_data is not None:
        processed_data = pipeline.preprocess_data(raw_data)
        pipeline.save_preprocessed_data(processed_data)
        
        features, feature_names = pipeline.prepare_features_for_model(processed_data)
        print(f"Feature shape: {features.shape}")
        print(f"Features: {feature_names}") 