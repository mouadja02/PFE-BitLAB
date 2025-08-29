import { NextResponse } from 'next/server';
import snowflake from 'snowflake-sdk';

// Snowflake connection configuration
const connectionOptions = {
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USERNAME,
  password: process.env.SNOWFLAKE_PASSWORD,
  role: process.env.SNOWFLAKE_ROLE || 'SYSADMIN',
  warehouse: "INT_WH",
  database: "BTC_DATA",
  schema: "DATA",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get('table');
  const column = searchParams.get('column');
  const timeframe = searchParams.get('timeframe');
  const days = searchParams.get('days');
  const limit = searchParams.get('limit');
  const includeBtcPrice = searchParams.get('includeBtcPrice') === 'true';

  if (!table || !column) {
    return NextResponse.json(
      { error: 'Table and column parameters are required' },
      { status: 400 }
    );
  }

  try {
    // Create connection
    const connection = snowflake.createConnection(connectionOptions);

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

    // Determine the date column name based on the table
    let dateColumn = 'DATE';
    if (table.includes('HOURLY')) {
      dateColumn = 'DATETIME';
    }
    
    // Handle special cases for Analytics tables
    if (table.includes('ANALYTICS.HOURLY_FNG') || table.includes('ANALYTICS.DAILY_FNG')) {
      dateColumn = 'ANALYSIS_DATE';
    }

    console.log(days);
    // Build the SQL query based on timeframe
    let whereClause = '';
    if (days && days !== 'null') {
      whereClause = `WHERE m.${dateColumn} >= DATEADD(day, -${days}, CURRENT_DATE()) AND m.${dateColumn} >= '2010-10-01'`;
    }
    else {
      whereClause = `WHERE m.${dateColumn} >= '2010-10-01'`;
    }

    // Use provided limit or default based on timeframe
    const queryLimit = limit ? parseInt(limit) : (days === null || days === 'null' ? 10000 : 1000);

    // Handle schema prefixes in table name
    let fullTablePath;
    if (table.includes('.')) {
      // Table already includes schema (e.g., "ANALYTICS.HOURLY_FNG")
      fullTablePath = `BTC_DATA.${table}`;
    } else {
      // Use default DATA schema
      fullTablePath = `BTC_DATA.DATA.${table}`;
    }

    let query;
    
    if (includeBtcPrice && !table.includes('OHCLV_DATA')) {
      // JOIN query to get matching dates between indicator and BTC price
      query = `
        SELECT 
          m.${dateColumn} as DATE, 
          m.${column},
          b.CLOSE AS BTC_PRICE_USD
        FROM ${fullTablePath} m
        INNER JOIN BTC_DATA.DATA.OHCLV_DATA b 
          ON m.${dateColumn} = b.DATE
        ${whereClause}
        ORDER BY m.${dateColumn} ASC
        LIMIT ${queryLimit}
      `;
    } else {
      // Check if this is OHLCV candlestick data request
      if (column === 'OHLCV' && table === 'OHCLV_DATA') {
        // Special query for OHLCV candlestick data - fetches all OHLCV columns at once
        query = `
          SELECT ${dateColumn} as DATE, OPEN, HIGH, LOW, CLOSE, VOLUME
          FROM ${fullTablePath}
          WHERE ${dateColumn} >= DATEADD(day, -${days}, CURRENT_DATE()) AND ${dateColumn} >= '2010-10-01'
          ORDER BY ${dateColumn} ASC
          LIMIT ${queryLimit}
        `;
      } else {
        // Regular query for single metric or BTC price only
        query = `
          SELECT ${dateColumn} as DATE, ${column}
          FROM ${fullTablePath}
          WHERE ${dateColumn} >= DATEADD(day, -${days}, CURRENT_DATE()) AND ${dateColumn} >= '2010-10-01'
          ORDER BY ${dateColumn} ASC
          LIMIT ${queryLimit}
        `;
      }
    }

    // Execute query
    const result = await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: query,
        complete: (err, stmt, rows) => {
          if (err) {
            console.error('Failed to execute statement:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      });
    });

    // Close connection
    connection.destroy((err) => {
      if (err) {
        console.error('Unable to disconnect:', err);
      } else {
        console.log('Disconnected from Snowflake');
      }
    });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300', // 5 minutes caching
      },
    });

  } catch (error) {
    console.error('Error fetching chart data:', error);
    
    // Return sample data for demonstration if Snowflake fails
    const sampleData = generateSampleData(table, column, parseInt(days || '365'), parseInt(limit || '1000'), includeBtcPrice);
    
    return NextResponse.json(sampleData, { 
      status: 206,
      headers: {
        'Cache-Control': 'public, s-maxage=60', // 1 minute caching for sample data
      },
    });
  }
}

// Generate sample data for demonstration
function generateSampleData(table: string, column: string, days: number, limit: number = 1000, includeBtcPrice: boolean = false) {
  // For "All" timeframe (days is NaN when null), generate 5 years of data
  const actualDays = isNaN(days) ? 1825 : days; // 5 years for "All"
  const dataPoints = Math.min(actualDays, limit);
  const data = [];

  // Handle OHLCV candlestick data
  if (column === 'OHLCV' && table === 'OHCLV_DATA') {
    for (let i = 0; i < dataPoints; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (dataPoints - i));
      
      const basePrice = 45000 + Math.sin(i / 30) * 10000; // Trend over time
      const dailyVolatility = 0.02 + Math.random() * 0.03; // 2-5% daily volatility
      
      const open = basePrice + (Math.random() - 0.5) * basePrice * dailyVolatility;
      const close = open + (Math.random() - 0.5) * open * dailyVolatility;
      const high = Math.max(open, close) + Math.random() * Math.abs(open - close);
      const low = Math.min(open, close) - Math.random() * Math.abs(open - close);
      const volume = 500 + Math.random() * 2000; // BTC volume

      data.push({
        DATE: date.toISOString().split('T')[0], // Keep as date string for API consistency
        OPEN: Math.max(1, open),
        HIGH: Math.max(1, high),
        LOW: Math.max(1, low),
        CLOSE: Math.max(1, close),
        VOLUME: Math.max(1, volume)
      });
    }
    return data;
  }

  for (let i = 0; i < dataPoints; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (dataPoints - i));
    
    // Generate realistic sample data based on metric type
    let baseValue = 50000;
    let volatility = 0.02;
    
    if (column.includes('PRICE') || column.includes('BTC_PRICE_USD')) {
      baseValue = 45000;
      volatility = 0.03;
    } else if (column.includes('MARKET_CAP')) {
      baseValue = 900000000000;
      volatility = 0.025;
    } else if (column.includes('MVRV')) {
      baseValue = 2.5;
      volatility = 0.1;
    } else if (column.includes('VOLUME')) {
      baseValue = 1000000;
      volatility = 0.15;
    } else if (column.includes('COUNT') || column.includes('ADDRESSES')) {
      baseValue = 300000;
      volatility = 0.05;
    } else if (column.includes('DIFFICULTY')) {
      baseValue = 50000000000000;
      volatility = 0.01;
    }

    const trend = Math.sin(i / 10) * 0.1;
    const noise = (Math.random() - 0.5) * volatility;
    const value = Math.max(0, baseValue * (1 + trend + noise));

    const dataPoint: any = {
      DATE: date.toISOString().split('T')[0],
      [column]: value
    };

    // Add BTC price if requested and not already BTC price
    if (includeBtcPrice && !table.includes('OHCLV_DATA') && !table.includes('BTC_PRICE_USD')) {
      const btcTrend = Math.sin(i / 10) * 0.1;
      const btcNoise = (Math.random() - 0.5) * 0.03;
      dataPoint.BTC_PRICE_USD = Math.max(0, 45000 * (1 + btcTrend + btcNoise));
    }

    data.push(dataPoint);
  }

  return data;
} 