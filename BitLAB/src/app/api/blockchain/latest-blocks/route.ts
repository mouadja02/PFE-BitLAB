import { NextResponse } from 'next/server';
import { createPool } from '@/lib/snowflake';

export async function GET() {
  try {
    console.log('Connecting to Snowflake to fetch latest blocks...');
    // Use the BITCOIN_ONCHAIN_CORE_DATA database from marketplace
    const pool = await createPool();
    
    const query = `
      SELECT 
        BLOCK_NUMBER,
        BLOCK_HASH,
        BLOCK_TIMESTAMP,
        TX_COUNT,
        SIZE,
        DIFFICULTY
      FROM 
        BITCOIN_ONCHAIN_CORE_DATA.core.FACT_BLOCKS
      ORDER BY 
        BLOCK_NUMBER DESC
      LIMIT 50
    `;
    
    console.log('Executing query for latest blocks...');
    const result = await pool.query(query);
    console.log(`Successfully fetched ${result.length} blocks`);
    
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching latest blocks:', error);
    
    // Provide more detailed error information
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch latest blocks',
        details: errorMessage,
        code: errorCode,
        connectionInfo: {
          account: process.env.SNOWFLAKE_ACCOUNT,
          username: process.env.SNOWFLAKE_USERNAME,
          database: process.env.SNOWFLAKE_DATABASE_ONCHAIN || 'BITCOIN_ONCHAIN_CORE_DATA',
          schema: process.env.SNOWFLAKE_SCHEMA_ONCHAIN || 'core',
          warehouse: process.env.SNOWFLAKE_WAREHOUSE,
        }
      },
      { status: 500 }
    );
  }
} 