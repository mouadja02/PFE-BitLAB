import { NextResponse } from 'next/server';
import snowflake from 'snowflake-sdk';

// Configure Snowflake connection
const connection = snowflake.createConnection({
  account: process.env.SNOWFLAKE_ACCOUNT!,
  username: process.env.SNOWFLAKE_USERNAME!,
  password: process.env.SNOWFLAKE_PASSWORD!,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
  database: process.env.SNOWFLAKE_DATABASE!,
  schema: process.env.SNOWFLAKE_SCHEMA!,
  role: process.env.SNOWFLAKE_ROLE,
  timeout: 120000,
  clientSessionKeepAlive: true,
  clientSessionKeepAliveHeartbeatFrequency: 3600,
});

interface HourlyTARequest {
  limitHours?: number;
  orderBy?: string;
  startTimestamp?: number;
  endTimestamp?: number;
}

export async function POST(request: Request) {
  try {
    const body: HourlyTARequest = await request.json();
    const { 
      limitHours = 168, // Default 7 days
      orderBy = 'UNIX_TIMESTAMP DESC',
      startTimestamp,
      endTimestamp 
    } = body;

    // Connect to Snowflake
    await new Promise((resolve, reject) => {
      connection.connect((err, conn) => {
        if (err) {
          console.error('Unable to connect to Snowflake:', err);
          reject(err);
        } else {
          console.log('Successfully connected to Snowflake');
          resolve(conn);
        }
      });
    });

    // Build the SQL query
    let sqlQuery = `
      SELECT 
        UNIX_TIMESTAMP,
        OPEN,
        HIGH,
        CLOSE,
        LOW,
        VOLUME,
        DATETIME,
        SMA_20,
        EMA_12,
        EMA_26,
        MACD,
        MACD_SIGNAL,
        MACD_DIFF,
        RSI,
        BB_HIGH,
        BB_LOW,
        BB_WIDTH,
        STOCH_K,
        STOCH_D,
        VOLUME_SMA,
        MFI,
        ATR,
        PRICE_CHANGE,
        HIGH_LOW_RATIO,
        CLOSE_OPEN_RATIO,
        VOLATILITY_30D,
        PRICE_VOLATILITY_30D,
        HL_VOLATILITY_30D
      FROM HOURLY_TA
    `;

    const conditions = [];
    
    // Add time-based filtering
    if (startTimestamp && endTimestamp) {
      conditions.push(`UNIX_TIMESTAMP BETWEEN ${startTimestamp} AND ${endTimestamp}`);
    } else if (limitHours) {
      // Get data from the last N hours
      conditions.push(`UNIX_TIMESTAMP >= EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP() - INTERVAL '${limitHours} HOURS'))`);
    }

    // Filter out null/invalid data
    conditions.push('OPEN IS NOT NULL');
    conditions.push('HIGH IS NOT NULL');
    conditions.push('LOW IS NOT NULL');
    conditions.push('CLOSE IS NOT NULL');
    conditions.push('VOLUME IS NOT NULL');

    if (conditions.length > 0) {
      sqlQuery += ' WHERE ' + conditions.join(' AND ');
    }

    sqlQuery += ` ORDER BY ${orderBy}`;
    
    // Add limit to prevent too much data
    if (limitHours && !startTimestamp && !endTimestamp) {
      sqlQuery += ` LIMIT ${Math.min(limitHours * 2, 2000)}`;
    }

    console.log('Executing SQL query:', sqlQuery);

    // Execute the query
    const result = await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: sqlQuery,
        complete: (err, stmt, rows) => {
          if (err) {
            console.error('Failed to execute statement:', err);
            reject(err);
          } else {
            console.log(`Successfully executed statement. Rows returned: ${rows?.length || 0}`);
            resolve(rows);
          }
        }
      });
    });

    // Destroy the connection
    connection.destroy((err) => {
      if (err) {
        console.error('Unable to disconnect from Snowflake:', err);
      } else {
        console.log('Disconnected from Snowflake');
      }
    });

    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        query: sqlQuery,
        rowCount: Array.isArray(result) ? result.length : 0,
        timestamp: new Date().toISOString(),
        limitHours,
        orderBy
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    
    // Make sure to destroy connection on error
    connection.destroy((err) => {
      if (err) {
        console.error('Unable to disconnect from Snowflake after error:', err);
      }
    });

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Add GET method for simple requests
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitHours = parseInt(searchParams.get('limitHours') || '168');
  const orderBy = searchParams.get('orderBy') || 'UNIX_TIMESTAMP DESC';

  // Convert to POST request format
  const postRequest = {
    json: async () => ({ limitHours, orderBy })
  } as Request;

  return POST(postRequest);
} 