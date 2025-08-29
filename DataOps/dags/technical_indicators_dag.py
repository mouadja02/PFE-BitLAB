"""
Technical Indicators DAG
Automatically updates the HOURLY_TA table with technical indicators
when new data is available in BTC_HOURLY_DATA
"""

from datetime import datetime, timedelta
import os
import pandas as pd
import numpy as np
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.snowflake.operators.snowflake import SnowflakeOperator
from airflow.providers.snowflake.hooks.snowflake import SnowflakeHook

# Technical Analysis library
try:
    import ta
except ImportError:
    print("Warning: ta library not installed. Install with: pip install ta")

# Default arguments
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 0,
    'retry_delay': timedelta(minutes=5),
}

# DAG definition
dag = DAG(
    'technical_indicators_update',
    default_args=default_args,
    description='Update HOURLY_TA table with technical indicators',
    schedule='02 * * * *',  # Every hour 
    catchup=False,
    tags=['bitcoin', 'technical-analysis', 'hourly', 'snowflake'],
)

# Snowflake connection parameters
snowflake_conn_params = {
    'snowflake_conn_id': 'snowflake_default',
    'warehouse': 'INT_WH',
    'database': os.getenv('SNOWFLAKE_DATABASE', 'BTC_DATA'),
    'schema': os.getenv('SNOWFLAKE_SCHEMA', 'DATA'),
}

def check_new_data(**context):
    """
    Check if there's new data in BTC_HOURLY_DATA that needs processing
    """
    try:
        print("🔍 Checking for new data in BTC_HOURLY_DATA...")
        
        hook = SnowflakeHook(snowflake_conn_id='snowflake_default')
        
        # Get the latest timestamp from HOURLY_TA
        latest_ta_query = """
        SELECT COALESCE(MAX(UNIX_TIMESTAMP), 0) as latest_timestamp
        FROM BTC_DATA.DATA.HOURLY_TA
        """
        
        latest_ta_result = hook.get_records(latest_ta_query)
        latest_ta_timestamp = latest_ta_result[0][0] if latest_ta_result else 0
        
        # Get the latest timestamp from BTC_HOURLY_DATA
        latest_btc_query = """
        SELECT COALESCE(MAX(UNIX_TIMESTAMP), 0) as latest_timestamp
        FROM BTC_DATA.DATA.BTC_HOURLY_DATA
        """
        
        latest_btc_result = hook.get_records(latest_btc_query)
        latest_btc_timestamp = latest_btc_result[0][0] if latest_btc_result else 0
        
        print(f"📊 Latest TA timestamp: {latest_ta_timestamp}")
        print(f"📊 Latest BTC timestamp: {latest_btc_timestamp}")
        
        # Check if we need to process new data
        if latest_btc_timestamp > latest_ta_timestamp:
            new_records = latest_btc_timestamp - latest_ta_timestamp
            print(f"✅ Found new data! Need to process {new_records} new records")
            
            # Push timestamps to XCom for next task
            context['ti'].xcom_push(key='latest_ta_timestamp', value=latest_ta_timestamp)
            context['ti'].xcom_push(key='latest_btc_timestamp', value=latest_btc_timestamp)
            context['ti'].xcom_push(key='has_new_data', value=True)
            
            return True
        else:
            print("ℹ️ No new data to process")
            context['ti'].xcom_push(key='has_new_data', value=False)
            return False
            
    except Exception as e:
        print(f"❌ Error checking for new data: {str(e)}")
        raise

def fetch_and_process_data(**context):
    """
    Fetch data from BTC_HOURLY_DATA and calculate technical indicators
    """
    try:
        # Check if we have new data to process
        has_new_data = context['ti'].xcom_pull(key='has_new_data', task_ids='check_new_data')
        
        if not has_new_data:
            print("ℹ️ No new data to process, skipping...")
            return None
        
        print("🔄 Fetching data from BTC_DATA.DATA.BTC_HOURLY_DATA...")
        
        hook = SnowflakeHook(snowflake_conn_id='snowflake_default')
        
        # Get the last 1000 records to ensure we have enough data for technical indicators
        # This ensures we have sufficient historical data for calculations
        query = """
        SELECT 
            UNIX_TIMESTAMP,
            OPEN,
            HIGH,
            CLOSE,
            LOW,
            VOLUME_TO as VOLUME
        FROM BTC_DATA.DATA.BTC_HOURLY_DATA
        ORDER BY UNIX_TIMESTAMP DESC
        LIMIT 1000
        """
        
        # Execute query and get results
        results = hook.get_records(query)
        
        if not results:
            print("❌ No data found in BTC_HOURLY_DATA")
            return None
        
        # Convert to DataFrame
        columns = ['UNIX_TIMESTAMP', 'OPEN', 'HIGH', 'CLOSE', 'LOW', 'VOLUME']
        df = pd.DataFrame(results, columns=columns)
        
        # Sort by timestamp ascending for proper calculation
        df = df.sort_values('UNIX_TIMESTAMP').reset_index(drop=True)
        
        print(f"✅ Fetched {len(df)} records for processing")
        
        # Add datetime column
        df['datetime'] = pd.to_datetime(df['UNIX_TIMESTAMP'], unit='s')
        
        # Calculate technical indicators
        df = add_technical_indicators(df)
        
        # Get only the new records that need to be inserted
        latest_ta_timestamp = context['ti'].xcom_pull(key='latest_ta_timestamp', task_ids='check_new_data')
        new_df = df[df['UNIX_TIMESTAMP'] > latest_ta_timestamp].copy()
        
        if len(new_df) == 0:
            print("ℹ️ No new records to insert after filtering")
            return None
        
        print(f"📊 Prepared {len(new_df)} new records for insertion")
        
        # Convert DataFrame to list of tuples for insertion
        records = []
        for _, row in new_df.iterrows():
            record = (
                int(row['UNIX_TIMESTAMP']),
                float(row['OPEN']),
                float(row['HIGH']),
                float(row['CLOSE']),
                float(row['LOW']),
                float(row['VOLUME']),
                row['datetime'].strftime('%Y-%m-%d %H:%M:%S'),
                float(row['sma_20']) if pd.notna(row['sma_20']) else None,
                float(row['ema_12']) if pd.notna(row['ema_12']) else None,
                float(row['ema_26']) if pd.notna(row['ema_26']) else None,
                float(row['macd']) if pd.notna(row['macd']) else None,
                float(row['macd_signal']) if pd.notna(row['macd_signal']) else None,
                float(row['macd_diff']) if pd.notna(row['macd_diff']) else None,
                float(row['rsi']) if pd.notna(row['rsi']) else None,
                float(row['bb_high']) if pd.notna(row['bb_high']) else None,
                float(row['bb_low']) if pd.notna(row['bb_low']) else None,
                float(row['bb_width']) if pd.notna(row['bb_width']) else None,
                float(row['stoch_k']) if pd.notna(row['stoch_k']) else None,
                float(row['stoch_d']) if pd.notna(row['stoch_d']) else None,
                float(row['volume_sma']) if pd.notna(row['volume_sma']) else None,
                float(row['mfi']) if pd.notna(row['mfi']) else None,
                float(row['atr']) if pd.notna(row['atr']) else None,
                float(row['price_change']) if pd.notna(row['price_change']) else None,
                float(row['high_low_ratio']) if pd.notna(row['high_low_ratio']) else None,
                float(row['close_open_ratio']) if pd.notna(row['close_open_ratio']) else None,
                float(row['volatility_30d']) if pd.notna(row['volatility_30d']) else None,
                float(row['price_volatility_30d']) if pd.notna(row['price_volatility_30d']) else None,
                float(row['hl_volatility_30d']) if pd.notna(row['hl_volatility_30d']) else None,
            )
            records.append(record)
        
        # Push records to XCom for insertion
        context['ti'].xcom_push(key='records_to_insert', value=records)
        
        print(f"✅ Prepared {len(records)} records for insertion")
        return len(records)
        
    except Exception as e:
        print(f"❌ Error processing data: {str(e)}")
        raise

def add_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add technical indicators to the DataFrame"""
    print("🔧 Adding technical indicators...")
    
    try:
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
        
        # Volume indicators
        df['volume_sma'] = df['VOLUME'].rolling(window=20).mean()
        mfi = ta.volume.MFIIndicator(high=df['HIGH'], low=df['LOW'], close=df['CLOSE'], volume=df['VOLUME'])
        df['mfi'] = mfi.money_flow_index()
        
        # Volatility indicators
        atr = ta.volatility.AverageTrueRange(high=df['HIGH'], low=df['LOW'], close=df['CLOSE'])
        df['atr'] = atr.average_true_range()
        
        # Price ratios and returns
        df['price_change'] = df['CLOSE'].pct_change()
        df['high_low_ratio'] = df['HIGH'] / df['LOW']
        df['close_open_ratio'] = df['CLOSE'] / df['OPEN']
        
        # 30-day volatility features (720 hours = 30 days)
        window = 720
        df['volatility_30d'] = df['price_change'].rolling(window=window).std() * np.sqrt(24)
        df['price_volatility_30d'] = df['CLOSE'].rolling(window=window).std()
        df['hl_volatility_30d'] = ((df['HIGH'] - df['LOW']) / df['CLOSE']).rolling(window=window).mean()
        
        print("✅ Technical indicators calculated successfully")
        return df
        
    except Exception as e:
        print(f"❌ Error calculating technical indicators: {str(e)}")
        raise

def insert_technical_indicators(**context):
    """
    Insert the calculated technical indicators into HOURLY_TA table
    """
    try:
        # Get records from XCom
        records = context['ti'].xcom_pull(key='records_to_insert', task_ids='process_data')
        
        if not records:
            print("ℹ️ No records to insert")
            return 0
        
        print(f"📊 Inserting {len(records)} records into HOURLY_TA...")
        
        hook = SnowflakeHook(snowflake_conn_id='snowflake_default')
        
        # Prepare the insert query
        insert_query = """
        INSERT INTO BTC_DATA.DATA.HOURLY_TA (
            UNIX_TIMESTAMP, OPEN, HIGH, CLOSE, LOW, VOLUME, datetime,
            sma_20, ema_12, ema_26, macd, macd_signal, macd_diff, rsi,
            bb_high, bb_low, bb_width, stoch_k, stoch_d, volume_sma, mfi, atr,
            price_change, high_low_ratio, close_open_ratio,
            volatility_30d, price_volatility_30d, hl_volatility_30d
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        """
        
        # Execute batch insert
        conn = hook.get_conn()
        cursor = conn.cursor()
        
        cursor.executemany(insert_query, records)
        conn.commit()
        
        cursor.close()
        conn.close()
        
        print(f"✅ Successfully inserted {len(records)} records into HOURLY_TA")
        return len(records)
        
    except Exception as e:
        print(f"❌ Error inserting data: {str(e)}")
        raise

# Define tasks
check_new_data_task = PythonOperator(
    task_id='check_new_data',
    python_callable=check_new_data,
    dag=dag,
)

process_data_task = PythonOperator(
    task_id='process_data',
    python_callable=fetch_and_process_data,
    dag=dag,
)

insert_data_task = PythonOperator(
    task_id='insert_technical_indicators',
    python_callable=insert_technical_indicators,
    dag=dag,
)

# Set task dependencies
check_new_data_task >> process_data_task >> insert_data_task 
