import snowflake from 'snowflake-sdk';

// Global connection instance
let globalConnection: snowflake.Connection | null = null;
let isConnecting = false;

const connectionConfig = {
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USERNAME,
  password: process.env.SNOWFLAKE_PASSWORD,
  role: process.env.SNOWFLAKE_ROLE || 'SYSADMIN',
  warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'INT_WH',
};

// Connect to Snowflake with connection reuse
const connectToSnowflake = async (): Promise<snowflake.Connection> => {
  // If already connected, return existing connection
  if (globalConnection && globalConnection.isUp()) {
    return globalConnection;
  }

  // If currently connecting, wait for it to complete
  if (isConnecting) {
    console.log('Waiting for existing connection attempt...');
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (globalConnection && globalConnection.isUp()) {
      return globalConnection;
    }
  }

  isConnecting = true;

  try {
    console.log('Creating new Snowflake connection...');
    const connection = snowflake.createConnection(connectionConfig);
    
    return new Promise((resolve, reject) => {
      connection.connect((err, conn) => {
        isConnecting = false;
        if (err) {
          console.error('Unable to connect to Snowflake:', err);
          globalConnection = null;
          reject(err);
        } else {
          console.log('Successfully connected to Snowflake!');
          globalConnection = conn;
          resolve(conn);
        }
      });
    });
  } catch (error) {
    isConnecting = false;
    console.error('Error creating Snowflake connection:', error);
    throw error;
  }
};

// Execute a query with connection reuse
export const executeQuery = async <T>(
  sqlText: string,
  binds: any[] = []
): Promise<T[]> => {
  try {
    const connection = await connectToSnowflake();
    
    return new Promise((resolve, reject) => {
      const statement = connection.execute({
        sqlText,
        binds,
        complete: (err, stmt, rows) => {
          if (err) {
            console.error('Failed to execute query:', err);
            reject(err);
          } else {
            resolve(rows as T[]);
          }
          // Don't disconnect after each query - keep connection alive
        },
      });
    });
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
};

// Functions for specific data retrieval from BITCOIN_ONCHAIN_CORE_DATA (for block exploration)
export const getOnChainData = async <T>(
  sqlText: string,
  binds: any[] = []
): Promise<T[]> => {
  const database = process.env.SNOWFLAKE_DATABASE_ONCHAIN || 'BITCOIN_ONCHAIN_CORE_DATA';
  const schema = process.env.SNOWFLAKE_SCHEMA_ONCHAIN || 'CORE';
  
  const useDbSql = `USE DATABASE ${database}`;
  const useSchemaSql = `USE SCHEMA ${schema}`;
  
  try {
    await executeQuery(useDbSql);
    await executeQuery(useSchemaSql);
    return executeQuery<T>(sqlText, binds);
  } catch (error) {
    console.error('Error getting on-chain data:', error);
    throw error;
  }
};

// Functions for metrics data retrieval from BTC_DATA.DATA (for charts and analytics)
export const getMetricsData = async <T>(
  sqlText: string,
  binds: any[] = []
): Promise<T[]> => {
  const database = process.env.SNOWFLAKE_DATABASE_METRICS || 'BTC_DATA';
  const schema = process.env.SNOWFLAKE_SCHEMA_METRICS || 'DATA';
  
  const useDbSql = `USE DATABASE ${database}`;
  const useSchemaSql = `USE SCHEMA ${schema}`;
  
  try {
    await executeQuery(useDbSql);
    await executeQuery(useSchemaSql);
    return executeQuery<T>(sqlText, binds);
  } catch (error) {
    console.error('Error getting metrics data:', error);
    throw error;
  }
};

// Graceful shutdown function
export const closeConnection = async (): Promise<void> => {
  if (globalConnection && globalConnection.isUp()) {
    return new Promise((resolve) => {
      globalConnection!.destroy((err) => {
        if (err) {
          console.error('Error disconnecting from Snowflake:', err);
        } else {
          console.log('Disconnected from Snowflake');
        }
        globalConnection = null;
        resolve();
      });
    });
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing Snowflake connection...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing Snowflake connection...');
  await closeConnection();
  process.exit(0);
}); 