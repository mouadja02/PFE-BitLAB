import os
import pandas as pd
import numpy as np
import snowflake.connector
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def load_data_from_snowflake(save_csv=True, csv_path='btc_data.csv'):
    """Load data from Snowflake or fall back to local CSV."""
    
    try:
        conn = snowflake.connector.connect(
            user=os.getenv('SNOWFLAKE_USER'),
            password=os.getenv('SNOWFLAKE_PASSWORD'),
            account=os.getenv('SNOWFLAKE_ACCOUNT'),
            warehouse=os.getenv('SNOWFLAKE_WAREHOUSE'),
            database=os.getenv('SNOWFLAKE_DATABASE'),
            schema=os.getenv('SNOWFLAKE_SCHEMA')
        )
        cursor = conn.cursor()
        
        query = """
        SELECT DATE,
            CAST(OPEN AS FLOAT) AS OPEN,
            CAST(HIGH AS FLOAT) AS HIGH,
            CAST(LOW AS FLOAT) AS LOW,
            CAST(CLOSE AS FLOAT) AS CLOSE,
            CAST(VOLUME AS FLOAT) AS VOLUME,
            CAST(MVRV AS FLOAT) AS MVRV,
            CAST(NUPL AS FLOAT) AS NUPL 
        FROM BTC_DATA.DATA.ONCHAIN_STRATEGY ORDER BY DATE DESC
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        df = pd.DataFrame(rows, columns=columns)
        
        cursor.close()
        conn.close()
        
        df['DATE'] = pd.to_datetime(df['DATE'])
        df = df.sort_values('DATE')
        
        # Interpolate missing values
        data_columns = [col for col in df.columns if col != 'DATE']
        df = df.set_index('DATE').interpolate(method='time')
        
        if save_csv:
            df.to_csv(csv_path, index=True)
        
        return df
    
    except Exception as e:
        print(f"Error connecting to Snowflake: {e}")
        print("Attempting to load from local CSV file...")
        
        try:
            df = pd.read_csv(csv_path, parse_dates=['DATE'])
            df.set_index('DATE', inplace=True)
            return df
        except Exception as csv_error:
            print(f"Error loading CSV: {csv_error}")
            raise ValueError("Could not load data from either Snowflake or local CSV")

