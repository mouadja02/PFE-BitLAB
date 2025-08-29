from datetime import datetime, timedelta
import os
import requests
import base64
import pandas as pd
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.snowflake.operators.snowflake import SnowflakeOperator
from airflow.providers.snowflake.hooks.snowflake import SnowflakeHook

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

# BTC Backup DAG definition
dag = DAG(
    'btc_backup',
    default_args=default_args,
    description='Daily backup of Bitcoin OHCLV data to GitHub',
    schedule='05 23 * * *',  # Daily at midnighty

    catchup=False,
    tags=['bitcoin', 'backup', 'github'],
)

def get_config(**context):
    """Get configuration for backup"""
    config = {
        'GITHUB_USERNAME': os.getenv('GITHUB_USERNAME', 'mouadja02'),
        'GITHUB_REPO': os.getenv('GITHUB_REPO_BTC_HOURLY', 'bitcoin-hourly-ohclv-dataset'),
        'SNOWFLAKE_DATABASE': os.getenv('SNOWFLAKE_DATABASE', 'BTC_DATA'),
        'SNOWFLAKE_SCHEMA': os.getenv('SNOWFLAKE_SCHEMA', 'DATA'),
        'SNOWFLAKE_TABLE': 'BTC_HOURLY_DATA',
        'BACKUP_FOLDER': 'daily_backups'
    }
    return config

def fetch_snowflake_data(**context):
    """Fetch data from Snowflake using hook"""
    config = context['task_instance'].xcom_pull(task_ids='get_config')
    
    # Use Snowflake hook to execute query
    hook = SnowflakeHook(snowflake_conn_id='snowflake_default')
    
    query = f"""
    SELECT 
      UNIX_TIMESTAMP as time_unix,
      date as date_str,
      hour_of_day as hour_str,
      open as open_price,
      high as high_price,
      close as close_price,
      low as low_price,
      volume_from,
      volume_to
    FROM {config['SNOWFLAKE_DATABASE']}.{config['SNOWFLAKE_SCHEMA']}.{config['SNOWFLAKE_TABLE']}
    WHERE date_str >= DATEADD(day, 0, CURRENT_DATE())
    ORDER BY time_unix ASC
    LIMIT 24;
    """
    
    # Execute query and fetch results
    results = hook.get_records(query)
    
    # Convert to list of dictionaries
    columns = ['TIME_UNIX', 'DATE_STR', 'HOUR_STR', 'OPEN_PRICE', 'HIGH_PRICE', 'CLOSE_PRICE', 'LOW_PRICE', 'VOLUME_FROM', 'VOLUME_TO']
    data = [dict(zip(columns, row)) for row in results]
    
    return data

def process_backup_data(**context):
    """Process the backup data from Snowflake into CSV format"""
    
    # Get data from previous task
    data = context['task_instance'].xcom_pull(task_ids='fetch_backup_data')
    
    if not data:
        raise ValueError("No data received from Snowflake")
    
    # Get current date for filename
    now = datetime.now()
    date_str = now.strftime('%Y-%m-%d')
    
    # CSV header
    csv_content = "TIME_UNIX,DATE_STR,HOUR_STR,OPEN_PRICE,HIGH_PRICE,CLOSE_PRICE,LOW_PRICE,VOLUME_FROM,VOLUME_TO\n"
    
    # Add each row
    for row in data:
        line = [
            str(row.get('TIME_UNIX', '')),
            str(row.get('DATE_STR', '')),
            str(row.get('HOUR_STR', '')),
            str(row.get('OPEN_PRICE', '')),
            str(row.get('HIGH_PRICE', '')),
            str(row.get('CLOSE_PRICE', '')),
            str(row.get('LOW_PRICE', '')),
            str(row.get('VOLUME_FROM', '')),
            str(row.get('VOLUME_TO', ''))
        ]
        csv_content += ','.join(line) + '\n'
    
    backup_data = {
        'csvContent': csv_content,
        'dateStr': date_str,
        'recordCount': len(data),
        'filename': f'btc_ohclv_{date_str}.csv',
        'backupTimestamp': now.isoformat(),
        'success': True
    }
    
    return backup_data

def upload_backup_to_github(**context):
    """Upload backup CSV to GitHub repository"""
    
    github_token = os.getenv('GITHUB_TOKEN')
    config = context['task_instance'].xcom_pull(task_ids='get_config')
    backup_data = context['task_instance'].xcom_pull(task_ids='process_backup_data')
    
    if not github_token:
        raise ValueError("GITHUB_TOKEN environment variable is required")
    
    if not backup_data or not backup_data.get('success'):
        raise ValueError("No valid backup data to upload")
    
    # GitHub API URL for file creation
    url = f"https://api.github.com/repos/{config['GITHUB_USERNAME']}/{config['GITHUB_REPO']}/contents/{backup_data['filename']}"
    
    # Encode content to base64
    content_base64 = base64.b64encode(backup_data['csvContent'].encode()).decode()
    
    # Prepare the request
    headers = {
        'Authorization': f'token {github_token}',
        'Accept': 'application/vnd.github.v3+json',
    }
    
    commit_message = f"Snowflake table daily backup for {backup_data['dateStr']}"
    
    data = {
        'message': commit_message,
        'content': content_base64,
    }
    
    try:
        # Check if file exists
        check_response = requests.get(url, headers=headers)
        
        if check_response.status_code == 200:
            # File exists, need to update with SHA
            existing_file = check_response.json()
            data['sha'] = existing_file['sha']
        
        # Create or update file
        response = requests.put(url, headers=headers, json=data)
        response.raise_for_status()
        
        print(f"Successfully uploaded backup to GitHub: {backup_data['filename']}")
        return True
        
    except Exception as e:
        print(f"Failed to upload backup to GitHub: {str(e)}")
        raise

def send_backup_telegram_notification(**context):
    """Send backup success notification via Telegram"""
    
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    chat_id = os.getenv('TELEGRAM_CHAT_ID', '1766877995')  # From your n8n config
    
    if not bot_token:
        print("TELEGRAM_BOT_TOKEN not found, skipping notification")
        return
    
    message = "✅ Daily OHCLV table successfully backed up on github repository 💾"
    
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    data = {
        'chat_id': chat_id,
        'text': message
    }
    
    try:
        response = requests.post(url, data=data)
        response.raise_for_status()
        print("Telegram backup notification sent successfully")
    except Exception as e:
        print(f"Failed to send Telegram backup notification: {str(e)}")

# Define tasks
get_config_task = PythonOperator(
    task_id='get_config',
    python_callable=get_config,
    dag=dag,
)

fetch_data_task = PythonOperator(
    task_id='fetch_backup_data',
    python_callable=fetch_snowflake_data,
    dag=dag,
)

process_data_task = PythonOperator(
    task_id='process_backup_data',
    python_callable=process_backup_data,
    dag=dag,
)

upload_github_task = PythonOperator(
    task_id='upload_backup_to_github',
    python_callable=upload_backup_to_github,
    dag=dag,
)

telegram_notification_task = PythonOperator(
    task_id='send_backup_telegram_notification',
    python_callable=send_backup_telegram_notification,
    dag=dag,
)

# Set task dependencies
get_config_task >> fetch_data_task >> process_data_task >> upload_github_task >> telegram_notification_task
