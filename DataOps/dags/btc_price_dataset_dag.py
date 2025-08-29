"""
BTC Price Dataset DAG
Replicates the n8n workflow for fetching Bitcoin hourly price data and storing in Snowflake
"""

from datetime import datetime, timedelta
import os
import json
import requests
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.snowflake.operators.snowflake import SnowflakeOperator
from airflow.providers.http.operators.http import SimpleHttpOperator
from airflow.providers.http.sensors.http import HttpSensor

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
    'btc_price_dataset',
    default_args=default_args,
    description='Fetch Bitcoin hourly price data and store in Snowflake',
    schedule='01 * * * *',  # Every hour
    catchup=False,
    tags=['bitcoin', 'cryptocurrency', 'snowflake'],
)

def fetch_btc_data(**context):
    """Fetch Bitcoin hourly data from CryptoCompare API"""
    
    url = "https://min-api.cryptocompare.com/data/v2/histohour"
    params = {
        'fsym': 'BTC',
        'tsym': 'USD',
        'limit': '48'
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data.get('Response') == 'Success':
            context['task_instance'].xcom_push(key='btc_raw_data', value=data)
            return data
        else:
            raise Exception(f"API returned error: {data.get('Message', 'Unknown error')}")
            
    except Exception as e:
        raise Exception(f"Failed to fetch BTC data: {str(e)}")

def transform_btc_data(**context):
    """Transform Bitcoin data for Snowflake insertion"""
    
    # Get data from previous task
    raw_data = context['task_instance'].xcom_pull(task_ids='fetch_btc_data', key='btc_raw_data')
    
    if not raw_data or 'Data' not in raw_data or 'Data' not in raw_data['Data']:
        raise Exception("No valid data received from API")
    
    response_data = raw_data['Data']['Data']
    
    # Get current timestamp for CREATED_AT
    current_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # Transform data for Snowflake
    snowflake_data = []
    for record in response_data:
        timestamp = (record['time']+7200) * 1000  # Convert to milliseconds
        date_obj = datetime.fromtimestamp(record['time'])
        
        # Format date as YYYY-MM-DD for Snowflake
        date = date_obj.strftime('%Y-%m-%d')
        
        # Get hour as integer (0-23)
        hour = date_obj.hour
        
        snowflake_record = {
            'UNIX_TIMESTAMP': record['time'],
            'DATE': date,
            'HOUR_OF_DAY': hour,
            'OPEN': record['open'],
            'HIGH': record['high'],
            'CLOSE': record['close'],
            'LOW': record['low'],
            'VOLUME_FROM': record['volumefrom'],
            'VOLUME_TO': record['volumeto'],
            'CREATED_AT': current_timestamp
        }
        snowflake_data.append(snowflake_record)
    
    # Generate bulk merge query
    bulk_values = []
    for record in snowflake_data:
        value_string = f"({record['UNIX_TIMESTAMP']}, '{record['DATE']}', {record['HOUR_OF_DAY']}, {record['OPEN']}, {record['HIGH']}, {record['CLOSE']}, {record['LOW']}, {record['VOLUME_FROM']}, {record['VOLUME_TO']}, '{record['CREATED_AT']}')"
        bulk_values.append(value_string)
    
    bulk_values_str = ',\n  '.join(bulk_values)
    
    bulk_merge_query = f"""
MERGE INTO BTC_DATA.DATA.BTC_HOURLY_DATA AS target
USING (
  SELECT column1 AS UNIX_TIMESTAMP, 
         column2 AS DATE, 
         column3 AS HOUR_OF_DAY, 
         column4 AS OPEN, 
         column5 AS HIGH, 
         column6 AS CLOSE, 
         column7 AS LOW, 
         column8 AS VOLUME_FROM, 
         column9 AS VOLUME_TO,
         column10 AS CREATED_AT
  FROM VALUES
  {bulk_values_str}
) AS source
ON target.UNIX_TIMESTAMP = source.UNIX_TIMESTAMP
WHEN MATCHED THEN UPDATE SET
  target.OPEN = source.OPEN,
  target.HIGH = source.HIGH,
  target.CLOSE = source.CLOSE,
  target.LOW = source.LOW,
  target.VOLUME_FROM = source.VOLUME_FROM,
  target.VOLUME_TO = source.VOLUME_TO,
  target.CREATED_AT = source.CREATED_AT
WHEN NOT MATCHED THEN INSERT
  (UNIX_TIMESTAMP, DATE, HOUR_OF_DAY, OPEN, HIGH, CLOSE, LOW, VOLUME_FROM, VOLUME_TO, CREATED_AT)
VALUES
  (source.UNIX_TIMESTAMP, source.DATE, source.HOUR_OF_DAY, source.OPEN, source.HIGH, source.CLOSE, source.LOW, source.VOLUME_FROM, source.VOLUME_TO, source.CREATED_AT);
"""
    
    # Store the query for the next task
    context['task_instance'].xcom_push(key='merge_query', value=bulk_merge_query)
    context['task_instance'].xcom_push(key='record_count', value=len(snowflake_data))
    
    print(f"✅ Transformed {len(snowflake_data)} records with CREATED_AT timestamp: {current_timestamp}")
    return len(snowflake_data)

def send_telegram_notification(**context):
    """Send success notification via Telegram"""
    
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    chat_id = os.getenv('TELEGRAM_CHAT_ID')
    
    if not bot_token or not chat_id:
        print("Telegram credentials not found, skipping notification")
        return
    
    record_count = context['task_instance'].xcom_pull(task_ids='transform_btc_data', key='record_count')
    message = f"✅ Hourly Price dataset successfully refreshed! 🔄 ❄️\nProcessed {record_count} records"
    
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    data = {
        'chat_id': chat_id,
        'text': message
    }
    
    try:
        response = requests.post(url, data=data)
        response.raise_for_status()
        print("Telegram notification sent successfully")
    except Exception as e:
        print(f"Failed to send Telegram notification: {str(e)}")

# Define tasks
fetch_data_task = PythonOperator(
    task_id='fetch_btc_data',
    python_callable=fetch_btc_data,
    dag=dag,
)

transform_data_task = PythonOperator(
    task_id='transform_btc_data',
    python_callable=transform_btc_data,
    dag=dag,
)

# Snowflake connection parameters
snowflake_conn_params = {
    'snowflake_conn_id': 'snowflake_default',
    'warehouse': os.getenv('SNOWFLAKE_WAREHOUSE', 'INT_WH'),
    'database': os.getenv('SNOWFLAKE_DATABASE', 'BTC_DATA'),
    'schema': os.getenv('SNOWFLAKE_SCHEMA', 'DATA'),
}

execute_merge_task = SnowflakeOperator(
    task_id='execute_snowflake_merge',
    sql="{{ task_instance.xcom_pull(task_ids='transform_btc_data', key='merge_query') }}",
    dag=dag,
    **snowflake_conn_params,
)

telegram_notification_task = PythonOperator(
    task_id='send_telegram_notification',
    python_callable=send_telegram_notification,
    dag=dag,
)

# Set task dependencies
fetch_data_task >> transform_data_task >> execute_merge_task >> telegram_notification_task 
