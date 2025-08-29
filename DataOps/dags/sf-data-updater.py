"""
Bitcoin Data Pipeline - Multi-DAG Implementation

This module implements a Bitcoin onchain data pipeline split into 3 separate DAGs 
to handle API rate limits (10 requests/hour maximum).

DAG Schedule:
- Batch 1 (3:00 AM): 6 metrics - realized_price, market_price, mvrv, nupl, 
                     supply_current, cdd_90dma
- Batch 2 (4:00 AM): 5 metrics - etf_flow_btc, miner_out_flows, miner_reserves,
                     nvt_ratio, puell_multiple  
- Batch 3 (5:00 AM): 5 metrics + Consolidation - reserve_risk, hashrate, thermo_cap,
                     true_market_mean, vocdd + creates final BITCOIN_DATA table

Key Features:
- Uses MERGE statements instead of TRUNCATE + INSERT for better performance
- Sequential processing within each batch to respect rate limits
- Consolidated table created after all metrics are processed
- Complete stage cleanup at the end of final batch

Efficiency Improvements:
- MERGE (UPSERT) operations for both individual metrics and consolidated table
- No unnecessary truncation operations
- Primary key constraints for data integrity
- Timestamp tracking for audit purposes
- Stage files preserved across batches and cleaned up at the end
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.snowflake.operators.snowflake import SnowflakeOperator
from airflow.providers.snowflake.hooks.snowflake import SnowflakeHook
import requests
import json
import os
import tempfile
import socket
import time
from functools import partial

# Default arguments
default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 0,
    'catchup': False,
    'execution_timeout': timedelta(minutes=60),
    'retry_exponential_backoff': True,
}

# DAG definitions - Split into 3 DAGs to handle API rate limits (10 requests/hour)
dag_batch1 = DAG(
    'btc_dataset_snowflake_updater_batch1',
    default_args=default_args,
    description='Daily update of Bitcoin onchain data - Batch 1 (6 metrics)',
    schedule='0 4 * * *',  # Run daily at 6 AM
    max_active_runs=1,
    tags=['bitcoin', 'dataset', 'daily', 'snowflake', 'metrics', 'batch1']
)

dag_batch2 = DAG(
    'btc_dataset_snowflake_updater_batch2',
    default_args=default_args,
    description='Daily update of Bitcoin onchain data - Batch 2 (5 metrics)',
    schedule='30 5 * * *',  # Run daily at 7h30 AM
    max_active_runs=1,
    tags=['bitcoin', 'dataset', 'daily', 'snowflake', 'metrics', 'batch2']
)

dag_batch3 = DAG(
    'btc_dataset_snowflake_updater_batch3',
    default_args=default_args,
    description='Daily update of Bitcoin onchain data - Batch 3 (5 metrics + consolidation)',
    schedule='0 7 * * *',  # Run daily at 9 AM
    max_active_runs=1,
    tags=['bitcoin', 'dataset', 'daily', 'snowflake', 'metrics', 'batch3']
)

# Split metrics into 3 batches to handle API rate limits (6+5+5)
batch1_metrics = [
    'realized_price', 'market_price', 'mvrv', 'nupl', 
    'supply_current', 'cdd_90dma'
]

batch2_metrics = [
    'etf_flow_btc', 'miner_out_flows', 'miner_reserves', 
    'nvt_ratio', 'puell_multiple'
]

batch3_metrics = [
    'reserve_risk', 'hashrate', 'thermo_cap', 
    'true_market_mean', 'vocdd'
]

# Complete list of all metric names (for reference)
metric_names = batch1_metrics + batch2_metrics + batch3_metrics

def get_metrics_config(metric_name):
    """Return configuration for a specific metric"""
    if metric_name == 'realized_price':
        return {
            'api_url': 'https://bitcoin-data.com/v1/realized-price',
            'table_name': 'REALIZED_PRICE',
            'columns': '(date, unix_ts, realized_price)',
            'select_clause': '''
                TO_DATE($1:theDay::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:realizedPrice::FLOAT as realized_price
            '''
        }
    elif metric_name == 'market_price':
        return {
            'api_url': 'https://bitcoin-data.com/v1/btc-price',
            'table_name': 'MARKET_PRICE',
            'columns': '(date, unix_ts, market_price)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:btcPrice::FLOAT as market_price
            '''
        }
    elif metric_name == 'mvrv':
        return {
            'api_url': 'https://bitcoin-data.com/v1/mvrv',
            'table_name': 'MVRV',
            'columns': '(date, unix_ts, mvrv)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:mvrv::FLOAT as mvrv
            '''
        }
    elif metric_name == 'nupl':
        return {
            'api_url': 'https://bitcoin-data.com/v1/nupl',
            'table_name': 'NUPL',
            'columns': '(date, unix_ts, nupl)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:nupl::FLOAT as nupl
            '''
        }
    elif metric_name == 'supply_current':
        return {
            'api_url': 'https://bitcoin-data.com/v1/supply-current',
            'table_name': 'SUPPLY_CURRENT',
            'columns': '(date, unix_ts, supply_current)',
            'select_clause': '''
                TO_DATE($1:theDay::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:supplyCurrent::FLOAT as supply_current
            '''
        }
    elif metric_name == 'cdd_90dma':
        return {
            'api_url': 'https://bitcoin-data.com/v1/cdd-90dma',
            'table_name': 'CDD_90DMA',
            'columns': '(date, unix_ts, cdd_90dma)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:cdd90dma::FLOAT as cdd_90dma
            '''
        }
    elif metric_name == 'etf_flow_btc':
        return {
            'api_url': 'https://bitcoin-data.com/v1/etf-flow-btc',
            'table_name': 'ETF_FLOW_BTC',
            'columns': '(date, unix_ts, etf_flow)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:etfFlow::FLOAT as etf_flow
            '''
        }
    elif metric_name == 'miner_out_flows':
        return {
            'api_url': 'https://bitcoin-data.com/v1/out-flows',
            'table_name': 'MINER_OUT_FLOWS',
            'columns': '(date, unix_ts, out_flows)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:outFlows::FLOAT as out_flows
            '''
        }
    elif metric_name == 'miner_reserves':
        return {
            'api_url': 'https://bitcoin-data.com/v1/miner-reserves',
            'table_name': 'MINER_RESERVES',
            'columns': '(date, unix_ts, reserves)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:reserves::FLOAT as reserves
            '''
        }
    elif metric_name == 'nvt_ratio':
        return {
            'api_url': 'https://bitcoin-data.com/v1/nvt-ratio',
            'table_name': 'NVT_RATIO',
            'columns': '(date, unix_ts, nvt_ratio)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:nvtRatio::FLOAT as nvt_ratio
            '''
        }
    elif metric_name == 'puell_multiple':
        return {
            'api_url': 'https://bitcoin-data.com/v1/puell-multiple',
            'table_name': 'PUELL_MULTIPLE',
            'columns': '(date, unix_ts, puell_multiple)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:puellMultiple::FLOAT as puell_multiple
            '''
        }
    elif metric_name == 'reserve_risk':
        return {
            'api_url': 'https://bitcoin-data.com/v1/reserve-risk',
            'table_name': 'RESERVE_RISK',
            'columns': '(date, unix_ts, reserve_risk)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:reserveRisk::FLOAT as reserve_risk
            '''
        }
    elif metric_name == 'hashrate':
        return {
            'api_url': 'https://bitcoin-data.com/v1/hashrate',
            'table_name': 'HASHRATE',
            'columns': '(date, unix_ts, hashrate)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:hashrate::FLOAT as hashrate
            '''
        }
    elif metric_name == 'thermo_cap':
        return {
            'api_url': 'https://bitcoin-data.com/v1/thermo-cap',
            'table_name': 'THERMO_CAP',
            'columns': '(date, unix_ts, thermo_cap)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:thermoCap::FLOAT as thermo_cap
            '''
        }
    elif metric_name == 'true_market_mean':
        return {
            'api_url': 'https://bitcoin-data.com/v1/true-market-mean',
            'table_name': 'TRUE_MARKET_MEAN',
            'columns': '(date, unix_ts, true_market_mean)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:trueMarketMean::FLOAT as true_market_mean
            '''
        }
    elif metric_name == 'vocdd':
        return {
            'api_url': 'https://bitcoin-data.com/v1/vocdd',
            'table_name': 'VOCDD',
            'columns': '(date, unix_ts, vocdd)',
            'select_clause': '''
                TO_DATE($1:d::STRING, 'YYYY-MM-DD') as date,
                $1:unixTs::BIGINT as unix_ts,
                $1:vocdd::FLOAT as vocdd
            '''
        }
    else:
        raise ValueError(f"Unknown metric name: {metric_name}")

def download_and_upload_metric(metric_name, **context):
    """
    Download JSON from API and upload to Snowflake stage for a specific metric
    """
    config = get_metrics_config(metric_name)  # Call the function here
    api_url = config['api_url']

    try:
        print(f"Downloading {metric_name} data from: {api_url}")
        
        try:
            response = requests.get(
                api_url, 
                timeout=600
            )
            response.raise_for_status()
            
        except (requests.exceptions.RequestException, socket.gaierror) as e:
            raise Exception(f"Failed to download {metric_name} data")
    
        # Validate JSON
        json_data = response.json()
        print(f"Downloaded {len(json_data)} records for {metric_name}")
        
        # Validate that we have data
        if not json_data or len(json_data) == 0:
            raise Exception(f"No data received for {metric_name}")
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump(json_data, temp_file, indent=2)
            temp_file_path = temp_file.name
        
        # Upload to Snowflake stage
        snowflake_hook = SnowflakeHook(snowflake_conn_id='snowflake_default')
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        stage_filename = f"{metric_name}-{timestamp}.json"
        
        # Upload file to stage
        print(f"Uploading file to stage as: {stage_filename}")
        
        # Use Snowflake PUT command to upload file
        put_sql = f"PUT file://{temp_file_path} @BTC_DATA.FORECASTER.my_stage/{stage_filename}"
        snowflake_hook.run(put_sql)
        
        # Clean up temporary file
        os.unlink(temp_file_path)
        
        # Store filename in XCom for next task
        return stage_filename
        
    except Exception as e:
        print(f"Error details: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        raise Exception(f"Error in download_and_upload_{metric_name}: {str(e)}")

def merge_metric_data(metric_name, **context):
    """
    Merge data for a specific metric using MERGE statement (upsert)
    """
    config = get_metrics_config(metric_name)
    filename = context['task_instance'].xcom_pull(task_ids=f'download_{metric_name}')
    
    snowflake_hook = SnowflakeHook(snowflake_conn_id='snowflake_default')
    
    # Extract column names from config
    columns_str = config['columns'].strip('()')
    columns_list = [col.strip() for col in columns_str.split(',')]
    value_column = columns_list[-1]  # Last column is the metric value
    
    # Create table if not exists first
    create_table_sql = f"""
    CREATE TABLE IF NOT EXISTS BTC_DATA.FORECASTER.{config['table_name']} (
        date DATE,
        unix_ts BIGINT,
        {value_column} FLOAT,
        PRIMARY KEY (date)
    );
    """
    
    sql = f"""
    MERGE INTO BTC_DATA.FORECASTER.{config['table_name']} AS target
    USING (
        SELECT 
            {config['select_clause']}
        FROM @BTC_DATA.FORECASTER.my_stage/{filename} (FILE_FORMAT => BTC_DATA.FORECASTER.json_format)
    ) AS source
    ON target.date = source.date
    WHEN MATCHED THEN
        UPDATE SET 
            unix_ts = source.unix_ts,
            {value_column} = source.{value_column}
    WHEN NOT MATCHED THEN
        INSERT {config['columns']}
        VALUES (source.date, source.unix_ts, source.{value_column});
    """
    
    print(f"Creating table for {metric_name} if not exists...")
    snowflake_hook.run(create_table_sql)
    
    print(f"Merging {metric_name} data from file: {filename}")
    result = snowflake_hook.run(sql)
    print(f"Merge completed for {metric_name}: {result}")
    
    # Note: Individual file cleanup removed - will be done at the end of batch 3
    
    return result

def create_consolidated_table(**context):
    """
    Create/update consolidated table with all Bitcoin metrics using MERGE
    """
    snowflake_hook = SnowflakeHook(snowflake_conn_id='snowflake_default')
    
    # Create or replace the consolidated table with all metrics
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS BTC_DATA.DATA.BITCOIN_DATA (
        date DATE,
        unix_ts BIGINT,
        realized_price FLOAT,
        market_price FLOAT,
        mvrv FLOAT,
        nupl FLOAT,
        supply_current FLOAT,
        cdd_90dma FLOAT,
        etf_flow FLOAT,
        out_flows FLOAT,
        reserves FLOAT,
        nvt_ratio FLOAT,
        puell_multiple FLOAT,
        reserve_risk FLOAT,
        hashrate FLOAT,
        thermo_cap FLOAT,
        true_market_mean FLOAT,
        vocdd FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
        PRIMARY KEY (date)
    );
    """
    
    print("Creating consolidated table if it doesn't exist...")
    snowflake_hook.run(create_table_sql)
    
    # Use MERGE to insert/update data efficiently
    merge_sql = """
    MERGE INTO BTC_DATA.DATA.BITCOIN_DATA AS target
    USING (
        SELECT 
            all_dates.date,
            COALESCE(rp.unix_ts, mp.unix_ts, mv.unix_ts, np.unix_ts, sc.unix_ts, 
                     cd.unix_ts, ef.unix_ts, mof.unix_ts, mr.unix_ts, nvt.unix_ts,
                     pm.unix_ts, rr.unix_ts, hr.unix_ts, tc.unix_ts, tmm.unix_ts, v.unix_ts) as unix_ts,
            rp.realized_price,
            mp.market_price,
            mv.mvrv,
            np.nupl,
            sc.supply_current,
            cd.cdd_90dma,
            ef.etf_flow,
            mof.out_flows,
            mr.reserves,
            nvt.nvt_ratio,
            pm.puell_multiple,
            rr.reserve_risk,
            hr.hashrate,
            tc.thermo_cap,
            tmm.true_market_mean,
            v.vocdd
        FROM (
            SELECT DISTINCT date FROM BTC_DATA.FORECASTER.REALIZED_PRICE 
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.MARKET_PRICE 
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.MVRV 
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.NUPL
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.SUPPLY_CURRENT
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.CDD_90DMA
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.ETF_FLOW_BTC
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.MINER_OUT_FLOWS
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.MINER_RESERVES
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.NVT_RATIO
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.PUELL_MULTIPLE
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.RESERVE_RISK
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.HASHRATE
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.THERMO_CAP
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.TRUE_MARKET_MEAN
            UNION SELECT DISTINCT date FROM BTC_DATA.FORECASTER.VOCDD
        ) all_dates
        LEFT JOIN BTC_DATA.FORECASTER.REALIZED_PRICE rp ON all_dates.date = rp.date
        LEFT JOIN BTC_DATA.FORECASTER.MARKET_PRICE mp ON all_dates.date = mp.date
        LEFT JOIN BTC_DATA.FORECASTER.MVRV mv ON all_dates.date = mv.date
        LEFT JOIN BTC_DATA.FORECASTER.NUPL np ON all_dates.date = np.date
        LEFT JOIN BTC_DATA.FORECASTER.SUPPLY_CURRENT sc ON all_dates.date = sc.date
        LEFT JOIN BTC_DATA.FORECASTER.CDD_90DMA cd ON all_dates.date = cd.date
        LEFT JOIN BTC_DATA.FORECASTER.ETF_FLOW_BTC ef ON all_dates.date = ef.date
        LEFT JOIN BTC_DATA.FORECASTER.MINER_OUT_FLOWS mof ON all_dates.date = mof.date
        LEFT JOIN BTC_DATA.FORECASTER.MINER_RESERVES mr ON all_dates.date = mr.date
        LEFT JOIN BTC_DATA.FORECASTER.NVT_RATIO nvt ON all_dates.date = nvt.date
        LEFT JOIN BTC_DATA.FORECASTER.PUELL_MULTIPLE pm ON all_dates.date = pm.date
        LEFT JOIN BTC_DATA.FORECASTER.RESERVE_RISK rr ON all_dates.date = rr.date
        LEFT JOIN BTC_DATA.FORECASTER.HASHRATE hr ON all_dates.date = hr.date
        LEFT JOIN BTC_DATA.FORECASTER.THERMO_CAP tc ON all_dates.date = tc.date
        LEFT JOIN BTC_DATA.FORECASTER.TRUE_MARKET_MEAN tmm ON all_dates.date = tmm.date
        LEFT JOIN BTC_DATA.FORECASTER.VOCDD v ON all_dates.date = v.date
        WHERE all_dates.date IS NOT NULL
    ) AS source
    ON target.date = source.date
    WHEN MATCHED THEN
        UPDATE SET 
            unix_ts = source.unix_ts,
            realized_price = source.realized_price,
            market_price = source.market_price,
            mvrv = source.mvrv,
            nupl = source.nupl,
            supply_current = source.supply_current,
            cdd_90dma = source.cdd_90dma,
            etf_flow = source.etf_flow,
            out_flows = source.out_flows,
            reserves = source.reserves,
            nvt_ratio = source.nvt_ratio,
            puell_multiple = source.puell_multiple,
            reserve_risk = source.reserve_risk,
            hashrate = source.hashrate,
            thermo_cap = source.thermo_cap,
            true_market_mean = source.true_market_mean,
            vocdd = source.vocdd,
            updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
        INSERT (date, unix_ts, realized_price, market_price, mvrv, nupl, 
                supply_current, cdd_90dma, etf_flow, out_flows, reserves,
                nvt_ratio, puell_multiple, reserve_risk, hashrate,
                thermo_cap, true_market_mean, vocdd)
        VALUES (source.date, source.unix_ts, source.realized_price, source.market_price, 
                source.mvrv, source.nupl, source.supply_current, source.cdd_90dma, 
                source.etf_flow, source.out_flows, source.reserves, source.nvt_ratio,
                source.puell_multiple, source.reserve_risk, source.hashrate,
                source.thermo_cap, source.true_market_mean, source.vocdd);
    """

    print("Merging data into consolidated table...")
    result = snowflake_hook.run(merge_sql)
    print(f"Consolidation completed: {result}")
    
    return result

def cleanup_stage(**context):
    """
    Clean up all files from the Snowflake stage after processing
    """
    snowflake_hook = SnowflakeHook(snowflake_conn_id='snowflake_default')
    
    # Remove all files from the stage
    cleanup_sql = "REMOVE @BTC_DATA.FORECASTER.my_stage"
    
    print("Cleaning up all files from stage...")
    result = snowflake_hook.run(cleanup_sql)
    print(f"Stage cleanup completed: {result}")
    
    return result

# Task 1: Create file format (shared by all DAGs)
create_file_format_batch1 = SnowflakeOperator(
    task_id='create_file_format',
    snowflake_conn_id='snowflake_default',
    sql="""
    CREATE FILE FORMAT IF NOT EXISTS BTC_DATA.FORECASTER.json_format
    TYPE = 'JSON'
    STRIP_OUTER_ARRAY = TRUE;
    """,
    dag=dag_batch1
)

create_file_format_batch2 = SnowflakeOperator(
    task_id='create_file_format',
    snowflake_conn_id='snowflake_default',
    sql="""
    CREATE FILE FORMAT IF NOT EXISTS BTC_DATA.FORECASTER.json_format
    TYPE = 'JSON'
    STRIP_OUTER_ARRAY = TRUE;
    """,
    dag=dag_batch2
)

create_file_format_batch3 = SnowflakeOperator(
    task_id='create_file_format',
    snowflake_conn_id='snowflake_default',
    sql="""
    CREATE FILE FORMAT IF NOT EXISTS BTC_DATA.FORECASTER.json_format
    TYPE = 'JSON'
    STRIP_OUTER_ARRAY = TRUE;
    """,
    dag=dag_batch3
)

# ========== BATCH 1 TASKS (3AM) ==========
download_tasks_batch1 = {}
merge_tasks_batch1 = {}

for metric_name in batch1_metrics:
    # Download task
    download_tasks_batch1[metric_name] = PythonOperator(
        task_id=f'download_{metric_name}',
        python_callable=partial(download_and_upload_metric, metric_name),
        dag=dag_batch1
    )
    
    # Merge task (replaces truncate + insert)
    merge_tasks_batch1[metric_name] = PythonOperator(
        task_id=f'merge_{metric_name}',
        python_callable=partial(merge_metric_data, metric_name),
        dag=dag_batch1
    )

# ========== BATCH 2 TASKS (4AM) ==========
download_tasks_batch2 = {}
merge_tasks_batch2 = {}

for metric_name in batch2_metrics:
    # Download task
    download_tasks_batch2[metric_name] = PythonOperator(
        task_id=f'download_{metric_name}',
        python_callable=partial(download_and_upload_metric, metric_name),
        dag=dag_batch2
    )
    
    # Merge task (replaces truncate + insert)
    merge_tasks_batch2[metric_name] = PythonOperator(
        task_id=f'merge_{metric_name}',
        python_callable=partial(merge_metric_data, metric_name),
        dag=dag_batch2
    )

# ========== BATCH 3 TASKS (5AM) ==========
download_tasks_batch3 = {}
merge_tasks_batch3 = {}

for metric_name in batch3_metrics:
    # Download task
    download_tasks_batch3[metric_name] = PythonOperator(
        task_id=f'download_{metric_name}',
        python_callable=partial(download_and_upload_metric, metric_name),
        dag=dag_batch3
    )
    
    # Merge task (replaces truncate + insert)
    merge_tasks_batch3[metric_name] = PythonOperator(
        task_id=f'merge_{metric_name}',
        python_callable=partial(merge_metric_data, metric_name),
        dag=dag_batch3
    )

# Consolidated table task (only in batch 3)
consolidate_task = PythonOperator(
    task_id='create_consolidated_table',
    python_callable=create_consolidated_table,
    dag=dag_batch3
)

# Stage cleanup task (final task in batch 3)
cleanup_task = PythonOperator(
    task_id='cleanup_stage',
    python_callable=cleanup_stage,
    dag=dag_batch3
)

# ========== BATCH 1 DEPENDENCIES (3AM) ==========
# Sequential execution for batch 1
create_file_format_batch1 >> download_tasks_batch1['realized_price'] >> merge_tasks_batch1['realized_price'] >> \
download_tasks_batch1['market_price'] >> merge_tasks_batch1['market_price'] >> \
download_tasks_batch1['mvrv'] >> merge_tasks_batch1['mvrv'] >> \
download_tasks_batch1['nupl'] >> merge_tasks_batch1['nupl'] >> \
download_tasks_batch1['supply_current'] >> merge_tasks_batch1['supply_current'] >> \
download_tasks_batch1['cdd_90dma'] >> merge_tasks_batch1['cdd_90dma']

# ========== BATCH 2 DEPENDENCIES (4AM) ==========
# Sequential execution for batch 2
create_file_format_batch2 >> download_tasks_batch2['etf_flow_btc'] >> merge_tasks_batch2['etf_flow_btc'] >> \
download_tasks_batch2['miner_out_flows'] >> merge_tasks_batch2['miner_out_flows'] >> \
download_tasks_batch2['miner_reserves'] >> merge_tasks_batch2['miner_reserves'] >> \
download_tasks_batch2['nvt_ratio'] >> merge_tasks_batch2['nvt_ratio'] >> \
download_tasks_batch2['puell_multiple'] >> merge_tasks_batch2['puell_multiple']

# ========== BATCH 3 DEPENDENCIES (5AM) ==========
# Sequential execution for batch 3 metrics, then consolidation, then cleanup
create_file_format_batch3 >> download_tasks_batch3['reserve_risk'] >> merge_tasks_batch3['reserve_risk'] >> \
download_tasks_batch3['hashrate'] >> merge_tasks_batch3['hashrate'] >> \
download_tasks_batch3['thermo_cap'] >> merge_tasks_batch3['thermo_cap'] >> \
download_tasks_batch3['true_market_mean'] >> merge_tasks_batch3['true_market_mean'] >> \
download_tasks_batch3['vocdd'] >> merge_tasks_batch3['vocdd'] >> \
consolidate_task >> cleanup_task
