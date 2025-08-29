import { NextResponse } from 'next/server';
import { createPool } from '@/lib/snowflake';

export async function GET() {
  try {
    console.log('Connecting to Snowflake to fetch tables...');
    // Force warehouse to INT_WH before creating pool for BTC_DATA
    process.env.SNOWFLAKE_DATABASE_ONCHAIN = 'BTC_DATA';
    process.env.SNOWFLAKE_SCHEMA_ONCHAIN = 'DATA';
    const pool = await createPool();
    
    const query = `
      SELECT DISTINCT TABLE_NAME
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'DATA'
      AND TABLE_CATALOG = 'BTC_DATA'
      ORDER BY TABLE_NAME
    `;
    
    console.log('Executing query for tables...');
    const result = await pool.query(query);
    console.log(`Successfully fetched ${result.length} tables`);
    
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching tables:', error);
    
    // Provide more detailed error information
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch tables',
        details: errorMessage,
        code: errorCode,
        connectionInfo: {
          account: process.env.SNOWFLAKE_ACCOUNT,
          username: process.env.SNOWFLAKE_USERNAME,
          database: process.env.SNOWFLAKE_DATABASE_ONCHAIN || 'BTC_DATA',
          schema: process.env.SNOWFLAKE_SCHEMA_ONCHAIN || 'DATA',
          warehouse: process.env.SNOWFLAKE_WAREHOUSE,
        }
      },
      { status: 500 }
    );
  }
} 