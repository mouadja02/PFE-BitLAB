import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

import datetime
import numpy as np
import pandas as pd
import requests
import os
from utils import load_data_from_snowflake
from main import (
    calculate_mvrv_zscore,
    calculate_nupl_zscore,
    calculate_combined_signal,
    generate_signals,
    backtest_strategy
)

# Paramètres optimisés de la stratégie
OPTIMIZED_PARAMS = {
    'combine_method': 'weighted',
    'ma_type': 'EMA',
    'ma_length': 160,
    'zscore_lookback': 120,
    'long_threshold': 0.56,
    'short_threshold': -0.45,
    'mvrv_weight': 0.63,
    'nupl_weight': 0.37,
    'initial_capital': 10000
}

# Configuration Telegram
TELEGRAM_BOT_TOKEN = my_telegram_bot_token    
TELEGRAM_CHAT_ID = my_chat_id



def prepare_forecasting_features(df):
    """Enhanced feature engineering specifically for your Bitcoin dataset"""
    
    forecast_df = df.copy()
    
    # Technical indicators
    forecast_df['sma_7'] = forecast_df['CLOSE'].rolling(7).mean()
    forecast_df['sma_21'] = forecast_df['CLOSE'].rolling(21).mean()
    forecast_df['ema_12'] = forecast_df['CLOSE'].ewm(span=12).mean()
    forecast_df['ema_26'] = forecast_df['CLOSE'].ewm(span=26).mean()
    
    # MACD
    forecast_df['macd'] = forecast_df['ema_12'] - forecast_df['ema_26']
    forecast_df['macd_signal'] = forecast_df['macd'].ewm(span=9).mean()
    forecast_df['macd_histogram'] = forecast_df['macd'] - forecast_df['macd_signal']
    
    # Bollinger Bands
    bb_period = 20
    forecast_df['bb_middle'] = forecast_df['CLOSE'].rolling(bb_period).mean()
    bb_std = forecast_df['CLOSE'].rolling(bb_period).std()
    forecast_df['bb_upper'] = forecast_df['bb_middle'] + (bb_std * 2)
    forecast_df['bb_lower'] = forecast_df['bb_middle'] - (bb_std * 2)
    forecast_df['bb_width'] = (forecast_df['bb_upper'] - forecast_df['bb_lower']) / forecast_df['bb_middle']
    forecast_df['bb_position'] = (forecast_df['CLOSE'] - forecast_df['bb_lower']) / (forecast_df['bb_upper'] - forecast_df['bb_lower'])
    
    # RSI
    delta = forecast_df['CLOSE'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    forecast_df['rsi'] = 100 - (100 / (1 + rs))
    
    # Price momentum and volatility
    forecast_df['price_change_1d'] = forecast_df['CLOSE'].pct_change()
    forecast_df['price_change_7d'] = forecast_df['CLOSE'].pct_change(7)
    forecast_df['price_change_30d'] = forecast_df['CLOSE'].pct_change(30)
    forecast_df['volatility_7d'] = forecast_df['price_change_1d'].rolling(7).std()
    forecast_df['volatility_30d'] = forecast_df['price_change_1d'].rolling(30).std()
    
    # Volume indicators
    forecast_df['volume_sma'] = forecast_df['VOLUME'].rolling(20).mean()
    forecast_df['volume_ratio'] = forecast_df['VOLUME'] / forecast_df['volume_sma']
    forecast_df['price_volume'] = forecast_df['CLOSE'] * forecast_df['VOLUME']
    
    # On-chain momentum (since you have MVRV and NUPL)
    forecast_df['mvrv_momentum'] = forecast_df['MVRV'].pct_change(7)
    forecast_df['nupl_momentum'] = forecast_df['NUPL'].pct_change(7)
    forecast_df['mvrv_ma_7'] = forecast_df['MVRV'].rolling(7).mean()
    forecast_df['nupl_ma_7'] = forecast_df['NUPL'].rolling(7).mean()
    
    # Z-score derivatives (assuming you have these from your main code)
    if 'MVRV_ZSCORE' in forecast_df.columns:
        forecast_df['mvrv_zscore_momentum'] = forecast_df['MVRV_ZSCORE'].diff()
        forecast_df['nupl_zscore_momentum'] = forecast_df['NUPL_ZSCORE'].diff()
        forecast_df['combined_zscore_momentum'] = forecast_df['COMBINED_ZSCORE'].diff()
        
        # Distance to your thresholds
        forecast_df['distance_to_sell_threshold'] = forecast_df['COMBINED_ZSCORE'] - (-0.45)
        forecast_df['distance_to_buy_threshold'] = 0.56 - forecast_df['COMBINED_ZSCORE']
    
    # Market structure
    forecast_df['high_low_ratio'] = forecast_df['HIGH'] / forecast_df['LOW']
    forecast_df['open_close_ratio'] = forecast_df['OPEN'] / forecast_df['CLOSE']
    
    return forecast_df

class BitcoinSignalPredictor:
    def __init__(self):
        self.timing_model = None
        self.price_model = None
        self.scaler_timing = StandardScaler()
        self.scaler_price = StandardScaler()
        self.feature_columns = None
        
    def prepare_signal_timing_data(self, df):
        """Prepare data for predicting days until next sell signal"""
        
        # Find all sell signals (assuming SIGNAL column exists from your strategy)
        sell_signals_idx = df[df['SIGNAL'] == -1].index
        
        X_list = []
        y_list = []
        
        # Create training data by looking at periods between sell signals
        for i in range(len(sell_signals_idx) - 1):
            current_sell_idx = df.index.get_loc(sell_signals_idx[i])
            next_sell_idx = df.index.get_loc(sell_signals_idx[i + 1])
            
            # Days until next sell signal
            days_to_next_sell = next_sell_idx - current_sell_idx
            
            # Helper function to safely get values
            def safe_get_feature(col, idx, default=0):
                try:
                    if col in df.columns:
                        val = df[col].iloc[idx]
                        return val if not pd.isna(val) else default
                    return default
                except Exception as e:
                    print(f"Error getting feature {col} at index {idx}: {e}")
                    return default
            
            # Features at current sell signal with safe extraction
            features = [
                safe_get_feature('COMBINED_ZSCORE', current_sell_idx, 0),
                safe_get_feature('MVRV_ZSCORE', current_sell_idx, safe_get_feature('MVRV', current_sell_idx, 0)),
                safe_get_feature('NUPL_ZSCORE', current_sell_idx, safe_get_feature('NUPL', current_sell_idx, 0)),
                safe_get_feature('rsi', current_sell_idx, 50),
                safe_get_feature('volatility_30d', current_sell_idx, 0.02),
                safe_get_feature('bb_position', current_sell_idx, 0.5),
                safe_get_feature('volume_ratio', current_sell_idx, 1.0),
                safe_get_feature('macd_histogram', current_sell_idx, 0),
                safe_get_feature('price_change_30d', current_sell_idx, 0)
            ]
            
            # Only add if all features are valid numbers
            if all(isinstance(f, (int, float)) and not pd.isna(f) for f in features):
                X_list.append(features)
                y_list.append(days_to_next_sell)
            else:
                print(f"Skipping invalid features at index {current_sell_idx}: {features}")
        
        return np.array(X_list), np.array(y_list)
    
    def prepare_price_sequence_data(self, df, lookback_days=60):
        """Prepare sequence data for LSTM price forecasting at variable future dates"""
        
        # Select relevant features for price prediction (excluding CLOSE as it's the target)
        price_features = ['VOLUME', 'MVRV', 'NUPL', 'rsi', 'macd', 'bb_position', 'volatility_7d']
        available_features = [col for col in price_features if col in df.columns]
        
        print(f"Training features: {available_features}")
        print(f"Number of training features: {len(available_features)}")
        
        # Store the feature list for later use in prediction
        self.training_features = available_features
        
        # Create a clean dataframe with only the needed columns
        df_subset = df[available_features + ['CLOSE']].copy()
        
        # Convert to numpy arrays for easier handling
        feature_data = df_subset[available_features].values
        # Ensure target_data is 1D by explicitly selecting the CLOSE column
        target_data = df_subset['CLOSE'].values.flatten()  # Ensure 1D
        
        # Replace NaN values with reasonable defaults
        for i, col in enumerate(available_features):
            col_data = feature_data[:, i]
            nan_mask = np.isnan(col_data)
            
            if nan_mask.any():
                if col == 'CLOSE':
                    # Forward fill for price data
                    valid_indices = ~nan_mask
                    if valid_indices.any():
                        last_valid = col_data[valid_indices][-1]
                        col_data[nan_mask] = last_valid
                    else:
                        col_data[nan_mask] = 50000  # Default price
                elif col == 'VOLUME':
                    # Use median for volume
                    valid_data = col_data[~nan_mask]
                    if len(valid_data) > 0:
                        col_data[nan_mask] = np.median(valid_data)
                    else:
                        col_data[nan_mask] = 1000000
                elif col in ['MVRV', 'NUPL']:
                    col_data[nan_mask] = 1.0
                elif col == 'rsi':
                    col_data[nan_mask] = 50.0
                elif col == 'bb_position':
                    col_data[nan_mask] = 0.5
                elif col == 'volatility_7d':
                    col_data[nan_mask] = 0.02
                else:
                    col_data[nan_mask] = 0.0
                
                feature_data[:, i] = col_data
        
        # Handle NaN in target data
        target_nan_mask = np.isnan(target_data)
        if target_nan_mask.any():
            # Forward fill target data
            valid_indices = ~target_nan_mask
            if valid_indices.any():
                for i in range(len(target_data)):
                    if target_nan_mask[i]:
                        # Find the last valid value
                        last_valid_idx = np.where(valid_indices[:i])[0]
                        if len(last_valid_idx) > 0:
                            target_data[i] = target_data[last_valid_idx[-1]]
                        else:
                            target_data[i] = 50000  # Default price
        
        # Find sell signals to create training data
        sell_signals_idx = df[df['SIGNAL'] == -1].index
        
        # Create sequences with variable forecast horizons
        X, y, forecast_days_list = [], [], []
        
        for i in range(len(sell_signals_idx) - 1):
            current_sell_idx = df.index.get_loc(sell_signals_idx[i])
            next_sell_idx = df.index.get_loc(sell_signals_idx[i + 1])
            
            # Days until next sell signal
            days_to_next_sell = next_sell_idx - current_sell_idx
            
            # Only use if we have enough lookback data and reasonable forecast horizon
            if current_sell_idx >= lookback_days and days_to_next_sell <= 365:  # Max 1 year forecast
                # Input sequence (features at sell signal)
                sequence_data = feature_data[current_sell_idx-lookback_days:current_sell_idx]
                
                # Target: price at next sell signal
                target_price = target_data[next_sell_idx]
                
                # Only add if no NaN values remain
                if not np.isnan(sequence_data).any() and not np.isnan(target_price):
                    X.append(sequence_data)
                    y.append(target_price)
                    forecast_days_list.append(days_to_next_sell)
        
        return np.array(X), np.array(y), np.array(forecast_days_list)
    
    def train_timing_model(self, df):
        """Train model to predict days until next sell signal"""
        
        X, y = self.prepare_signal_timing_data(df)
        
        if len(X) < 5:  # Need minimum data points
            print("Not enough sell signals in historical data for timing prediction")
            return False
        
        # Scale features
        X_scaled = self.scaler_timing.fit_transform(X)
        
        # Use ensemble of models
        self.timing_model = {
            'rf': RandomForestRegressor(n_estimators=100, random_state=42),
            'gb': GradientBoostingRegressor(n_estimators=100, random_state=42)
        }
        
        for name, model in self.timing_model.items():
            model.fit(X_scaled, y)
        
        # Evaluate
        predictions_rf = self.timing_model['rf'].predict(X_scaled)
        predictions_gb = self.timing_model['gb'].predict(X_scaled)
        
        print(f"Timing Model Performance:")
        print(f"Random Forest MAE: {mean_absolute_error(y, predictions_rf):.2f} days")
        print(f"Gradient Boosting MAE: {mean_absolute_error(y, predictions_gb):.2f} days")
        
        return True
    
    def train_price_model(self, df, lookback_days=60):
        """Train LSTM model for price forecasting at sell signal dates"""
        
        X, y, forecast_days = self.prepare_price_sequence_data(df, lookback_days)
        
        if len(X) < 10:  # Reduced requirement since we're using sell signals
            print(f"Not enough data for LSTM training. Found {len(X)} sequences, need at least 10.")
            return False
        
        # Clean data by removing sequences with NaN values
        valid_indices = []
        for i in range(len(X)):
            if not np.isnan(X[i]).any() and not np.isnan(y[i]):
                valid_indices.append(i)
        
        if len(valid_indices) < 5:  # Reduced requirement
            print(f"Not enough clean data for LSTM training after NaN removal. Found {len(valid_indices)} clean sequences, need at least 5.")
            return False
        
        X_clean = X[valid_indices]
        y_clean = y[valid_indices]
        forecast_days_clean = forecast_days[valid_indices]
        
        print(f"Using {len(X_clean)} clean sequences out of {len(X)} total sequences")
        
        # Debug: Print shapes
        print(f"X_clean shape: {X_clean.shape}")
        print(f"y_clean shape: {y_clean.shape}")
        print(f"Forecast days range: {forecast_days_clean.min()}-{forecast_days_clean.max()} days")
        
        # Scale the data
        X_reshaped = X_clean.reshape(-1, X_clean.shape[-1])
        
        # Check for NaN in reshaped data
        if np.isnan(X_reshaped).any():
            print("Warning: NaN found in X_reshaped, replacing with zeros")
            X_reshaped = np.nan_to_num(X_reshaped, nan=0.0)
        
        if np.isnan(y_clean).any():
            print("Warning: NaN found in y_clean, replacing with mean")
            y_mean = np.nanmean(y_clean)
            if np.isnan(y_mean):
                y_mean = 50000  # Default price
            y_clean[np.isnan(y_clean)] = y_mean
        
        X_scaled = self.scaler_price.fit_transform(X_reshaped)
        X_scaled = X_scaled.reshape(X_clean.shape)
        
        # Split data
        split_idx = int(len(X_scaled) * 0.8)
        X_train, X_test = X_scaled[:split_idx], X_scaled[split_idx:]
        y_train, y_test = y_clean[:split_idx], y_clean[split_idx:]
        
        # Debug: Print training shapes
        print(f"X_train shape: {X_train.shape}")
        print(f"y_train shape: {y_train.shape}")
        print(f"X_test shape: {X_test.shape}")
        print(f"y_test shape: {y_test.shape}")
        
        # Build LSTM model for single price prediction
        self.price_model = Sequential([
            LSTM(50, return_sequences=True, input_shape=(lookback_days, X_clean.shape[-1])),
            Dropout(0.2),
            LSTM(50, return_sequences=False),
            Dropout(0.2),
            Dense(100, activation='relu'),
            BatchNormalization(),
            Dense(1)  # Single price output
        ])
        
        self.price_model.compile(optimizer='adam', loss='mse', metrics=['mae'])
        
        # Train
        history = self.price_model.fit(
            X_train, y_train,
            epochs=50,
            batch_size=32,
            validation_data=(X_test, y_test),
            verbose=0
        )
        
        # Evaluate with NaN handling
        test_predictions = self.price_model.predict(X_test)
        
        # Check for NaN in predictions
        if np.isnan(test_predictions).any():
            print("Warning: Model produced NaN predictions, replacing with target mean")
            test_predictions[np.isnan(test_predictions)] = np.nanmean(y_test)
        
        # Calculate MAE only on valid (non-NaN) predictions
        y_test_flat = y_test.flatten()
        test_pred_flat = test_predictions.flatten()
        
        # Remove any remaining NaN pairs
        valid_mask = ~(np.isnan(y_test_flat) | np.isnan(test_pred_flat))
        if valid_mask.sum() > 0:
            test_mae = mean_absolute_error(y_test_flat[valid_mask], test_pred_flat[valid_mask])
            print(f"Price Model MAE: ${test_mae:.2f}")
        else:
            print("Warning: No valid predictions for MAE calculation")
        
        return True
    
    def predict_next_sell_signal_timing(self, current_features):
        """Predict days until next sell signal"""
        
        if self.timing_model is None:
            return None
        
        # Scale current features
        current_features_scaled = self.scaler_timing.transform([current_features])
        
        # Ensemble prediction
        pred_rf = self.timing_model['rf'].predict(current_features_scaled)[0]
        pred_gb = self.timing_model['gb'].predict(current_features_scaled)[0]
        
        # Average the predictions
        avg_prediction = (pred_rf + pred_gb) / 2
        
        return {
            'days_to_sell_signal': int(avg_prediction),
            'rf_prediction': int(pred_rf),
            'gb_prediction': int(pred_gb),
            'confidence_range': (int(min(pred_rf, pred_gb)), int(max(pred_rf, pred_gb)))
        }
    
    def predict_price_at_sell_signal(self, recent_data, estimated_days_to_sell):
        """Predict price at the estimated sell signal date"""
        
        if self.price_model is None:
            return None
        
        # Use the exact same features as in training
        if hasattr(self, 'training_features'):
            available_features = self.training_features
        else:
            # Fallback to default features if training_features not set
            price_features = ['VOLUME', 'MVRV', 'NUPL', 'rsi', 'macd', 'bb_position', 'volatility_7d']
            available_features = [col for col in price_features if col in recent_data.columns]
        
        print(f"Prediction features: {available_features}")
        print(f"Number of prediction features: {len(available_features)}")
        print(f"Predicting price in {estimated_days_to_sell} days (at estimated sell signal)")
        
        # Verify all required features are available
        missing_features = [col for col in available_features if col not in recent_data.columns]
        if missing_features:
            print(f"Error: Missing features for prediction: {missing_features}")
            return None
        
        # Get last 60 days of data
        last_sequence = recent_data[available_features].tail(60)
        
        # Handle NaN values by forward filling and then backward filling
        last_sequence = last_sequence.ffill().bfill()
        
        # If still NaN values exist, fill with column means
        for col in last_sequence.columns:
            if last_sequence[col].isna().sum() > 0:
                col_mean = recent_data[col].mean()
                if pd.isna(col_mean):
                    # If mean is also NaN, use reasonable defaults
                    if col == 'CLOSE':
                        col_mean = recent_data['CLOSE'].iloc[-1] if not pd.isna(recent_data['CLOSE'].iloc[-1]) else 50000
                    elif col == 'VOLUME':
                        col_mean = recent_data['VOLUME'].mean() if not pd.isna(recent_data['VOLUME'].mean()) else 1000000
                    elif col in ['MVRV', 'NUPL']:
                        col_mean = 1.0
                    elif col == 'rsi':
                        col_mean = 50.0
                    elif col == 'bb_position':
                        col_mean = 0.5
                    elif col == 'volatility_7d':
                        col_mean = 0.02
                    else:
                        col_mean = 0.0
                
                last_sequence[col] = last_sequence[col].fillna(col_mean)
        
        # Convert to numpy array
        last_sequence_values = last_sequence.values
        
        # Check for any remaining NaN values
        if np.isnan(last_sequence_values).any():
            print("Warning: NaN values still present in sequence, replacing with zeros")
            last_sequence_values = np.nan_to_num(last_sequence_values, nan=0.0)
        
        print(f"Prediction sequence shape: {last_sequence_values.shape}")
        
        # Ensure we have the correct number of features
        if last_sequence_values.shape[1] != len(available_features):
            print(f"Warning: Expected {len(available_features)} features but got {last_sequence_values.shape[1]}.")
            return None
        
        # Scale
        last_sequence_scaled = self.scaler_price.transform(last_sequence_values.reshape(-1, last_sequence_values.shape[-1]))
        last_sequence_scaled = last_sequence_scaled.reshape(1, last_sequence_values.shape[0], last_sequence_values.shape[1])
        print(last_sequence_scaled)
        # Predict single price
        price_prediction = self.price_model.predict(last_sequence_scaled)[0][0]  # Single value
        
        print(f"You will sell at{price_prediction}")
        return price_prediction
    
    
def send_telegram_message(message):
    return

    
def enhanced_btc_strategy_with_forecast():
    """Enhanced version of your strategy with forecasting capabilities"""
    
    print(f"Exécution de la stratégie avec prévisions - {datetime.datetime.now()}")
    
    try:
        # Load your existing data (from your current pipeline)
        df = load_data_from_snowflake(save_csv=True)
        
        # Filter parameters for each function call
        mvrv_params = {
            'ma_type': OPTIMIZED_PARAMS['ma_type'],
            'ma_length': OPTIMIZED_PARAMS['ma_length'],
            'lookback': OPTIMIZED_PARAMS['zscore_lookback']
        }
        
        nupl_params = {
            'ma_type': OPTIMIZED_PARAMS['ma_type'],
            'ma_length': OPTIMIZED_PARAMS['ma_length'],
            'lookback': OPTIMIZED_PARAMS['zscore_lookback']
        }
        
        combined_params = {
            'method': OPTIMIZED_PARAMS['combine_method'],
            'mvrv_weight': OPTIMIZED_PARAMS['mvrv_weight'],
            'nupl_weight': OPTIMIZED_PARAMS['nupl_weight']
        }
        
        signal_params = {
            'long_threshold': OPTIMIZED_PARAMS['long_threshold'],
            'short_threshold': OPTIMIZED_PARAMS['short_threshold']
        }
        
        # Apply your existing strategy calculations with filtered parameters
        df = calculate_mvrv_zscore(df.copy(), **mvrv_params)
        df = calculate_nupl_zscore(df, **nupl_params)
        df = calculate_combined_signal(df, **combined_params)
        df = generate_signals(df, **signal_params)
        df = backtest_strategy(df, initial_capital=OPTIMIZED_PARAMS['initial_capital'])
        
        # Add enhanced features for forecasting
        df_enhanced = prepare_forecasting_features(df)
        
        # Initialize and train forecasting models
        predictor = BitcoinSignalPredictor()
        
        print("Training signal timing model...")
        timing_success = predictor.train_timing_model(df_enhanced)
        
        print("Training price forecasting model...")
        # Re-enable price model now that we've fixed the issues
        price_success = predictor.train_price_model(df_enhanced)
        # price_success = True
        # print("Price model training temporarily disabled for debugging")
        
        # Get current market state with NaN handling
        latest_idx = -1
        
        # Helper function to safely get values with NaN handling
        def safe_get_value(df, col, idx, default=0):
            if col in df.columns:
                val = df[col].iloc[idx]
                return val if not pd.isna(val) else default
            return default
        
        # Create current features with proper NaN handling
        current_features = [
            safe_get_value(df_enhanced, 'COMBINED_ZSCORE', latest_idx, 0),
            safe_get_value(df_enhanced, 'MVRV_ZSCORE', latest_idx, safe_get_value(df_enhanced, 'MVRV', latest_idx, 0)),
            safe_get_value(df_enhanced, 'NUPL_ZSCORE', latest_idx, safe_get_value(df_enhanced, 'NUPL', latest_idx, 0)),
            safe_get_value(df_enhanced, 'rsi', latest_idx, 50),  # Default RSI to neutral 50
            safe_get_value(df_enhanced, 'volatility_30d', latest_idx, 0.02),  # Default volatility
            safe_get_value(df_enhanced, 'bb_position', latest_idx, 0.5),  # Default BB position to middle
            safe_get_value(df_enhanced, 'volume_ratio', latest_idx, 1.0),  # Default volume ratio
            safe_get_value(df_enhanced, 'macd_histogram', latest_idx, 0),  # Default MACD histogram
            safe_get_value(df_enhanced, 'price_change_30d', latest_idx, 0)  # Default price change
        ]
        
        # Check if any features are still NaN
        if any(pd.isna(val) for val in current_features):
            print("Warning: Some features still contain NaN values, replacing with defaults")
            current_features = [0 if pd.isna(val) else val for val in current_features]
        
        print(f"Current features for prediction: {current_features}")
        
        # Make predictions
        forecasts = {}
        
        if timing_success:
            try:
                timing_forecast = predictor.predict_next_sell_signal_timing(current_features)
                forecasts['timing'] = timing_forecast
            except Exception as e:
                print(f"Error in timing prediction: {e}")
        
        if price_success:
            try:
                # Use timing forecast if available, otherwise use a default forecast period
                if 'timing' in forecasts and forecasts['timing'] is not None:
                    estimated_days = forecasts['timing']['days_to_sell_signal']
                else:
                    estimated_days = 90  # Default fallback
                
                price_forecast = predictor.predict_price_at_sell_signal(df_enhanced, estimated_days)
                forecasts['prices'] = price_forecast
                forecasts['price_forecast_days'] = estimated_days
            except Exception as e:
                print(f"Error in price prediction: {e}")
        
        # Your existing signal logic
        latest_date = df.index[-1]
        latest_signal = df['SIGNAL'].iloc[-1]
        current_position = df['POSITION'].iloc[-1]
        latest_price = df['CLOSE'].iloc[-1]
        
        # Enhanced message with forecasts
        forecast_message = ""
        
        if 'timing' in forecasts:
            timing = forecasts['timing']
            forecast_message += f"""
*🔮 PRÉVISION DU PROCHAIN SIGNAL DE VENTE*:
- Estimation: {timing['days_to_sell_signal']} jours
- Fourchette: {timing['confidence_range'][0]}-{timing['confidence_range'][1]} jours
- Date estimée: {(latest_date + pd.Timedelta(days=timing['days_to_sell_signal'])).strftime('%Y-%m-%d')}
"""
        
        if 'prices' in forecasts and forecasts['prices'] is not None:
            predicted_price = forecasts['prices']
            forecast_days = forecasts.get('price_forecast_days', 'unknown')
            current_price_change = (predicted_price - latest_price) / latest_price * 100
            
            forecast_message += f"""
*📈 PRÉVISION DE PRIX AU PROCHAIN SIGNAL DE VENTE*:
- Prix actuel: ${latest_price:.2f}
- Prix estimé dans {forecast_days} jours: ${predicted_price:.2f} ({current_price_change:+.2f}%)
- Horizon de prévision: {forecast_days} jours (date estimée du prochain signal de vente)
"""
        else:
            forecast_message += f"""
*📈 PRÉVISION DE PRIX*:
- Prix actuel: ${latest_price:.2f}
- Prévision de prix temporairement désactivée
"""
        
        # Create enhanced message (combine with your existing message logic)
        enhanced_message = f"""*Rapport de la Stratégie BTC avec Prévisions*

{forecast_message}

*SIGNAL ACTUEL*: [Your existing signal logic here]

[Rest of your existing message...]

⚠️ *AVERTISSEMENT PRÉVISIONS* ⚠️
_Les prévisions sont basées sur des modèles d'apprentissage automatique et l'analyse technique. Elles ne constituent pas des conseils financiers et peuvent être imprécises._
"""
        
        # Send enhanced message
        #send_telegram_message(enhanced_message)
        
        return df_enhanced, forecasts
        
    except Exception as e:
        error_message = f"⚠️ *ERREUR PRÉVISIONS* ⚠️\nErreur lors des prévisions: {str(e)}"
        print(error_message)
        import traceback
        traceback.print_exc()
        #send_telegram_message(error_message)
        return None, None
    
# Replace your main execution with this enhanced version
if __name__ == "__main__":
    df, forecasts = enhanced_btc_strategy_with_forecast()
    
    if forecasts:
        print("Prévisions générées avec succès:")
        print(f"Prochain signal de vente estimé dans {forecasts['timing']['days_to_sell_signal']} jours")
        forecast_days = forecasts.get('price_forecast_days', 'unknown')
        print(f"Prix estimé au prochain signal de vente (dans {forecast_days} jours): ${forecasts['prices']:.2f}")
