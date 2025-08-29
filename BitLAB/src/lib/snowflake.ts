import snowflake from 'snowflake-sdk';

// Interface for Snowflake query results
export interface SnowflakeQueryResult {
  rows: any[];
  rowCount: number;
  getColumnNames(): string[];
}

// Interface for Snowflake connection pool
export interface SnowflakePool {
  query(sql: string, binds?: any[]): Promise<any>;
  destroy(): Promise<void>;
}

// Create a Snowflake connection pool
export async function createPool(): Promise<SnowflakePool> {

  // Create a connection to Snowflake
  const connection = snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USERNAME,
    password: process.env.SNOWFLAKE_PASSWORD,
    database: process.env.SNOWFLAKE_DATABASE_ONCHAIN || 'bitcoin_onchain_core_data',
    schema: process.env.SNOWFLAKE_SCHEMA_ONCHAIN || 'core',
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'INT_WH',
    role: process.env.SNOWFLAKE_ROLE || 'SYSADMIN'
  });

  // Promisify the connect function
  const connectAsync = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      connection.connect((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  try {
    // Connect to Snowflake
    await connectAsync();
    console.log('Successfully connected to Snowflake');
    
    // Create a simple pool-like interface
    const poolInterface = {
      query: async (sql: string, binds: any[] = []): Promise<any> => {
        return new Promise((resolve, reject) => {
          const statement = connection.execute({
            sqlText: sql,
            binds: binds,
            complete: (err, stmt, rows) => {
              if (err) {
                console.error('Snowflake query error:', err.message);
                reject(err);
              } else {
                resolve(rows);
              }
            },
          });
        });
      },
      destroy: async (): Promise<void> => {
        return new Promise((resolve, reject) => {
          connection.destroy((err) => {
            // Connection destroyed
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      },
    };
    
    return poolInterface;
  } catch (error) {
    console.error('Error connecting to Snowflake:', error);
    throw error;
  }
} 