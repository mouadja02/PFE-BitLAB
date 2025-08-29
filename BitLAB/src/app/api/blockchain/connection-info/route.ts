import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Return connection info without actual credentials
    const connectionInfo = {
      account: process.env.SNOWFLAKE_ACCOUNT,
      username: process.env.SNOWFLAKE_USERNAME,
      database: process.env.SNOWFLAKE_DATABASE_ONCHAIN || 'bitcoin_onchain_core_data',
      schema: process.env.SNOWFLAKE_SCHEMA_ONCHAIN || 'core',
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'INT_WH',
      role: process.env.SNOWFLAKE_ROLE || 'SYSADMIN',
      // Include whether the environment variables exist
      envCheck: {
        account: !!process.env.SNOWFLAKE_ACCOUNT,
        username: !!process.env.SNOWFLAKE_USERNAME,
        password: !!process.env.SNOWFLAKE_PASSWORD,
        database: !!process.env.SNOWFLAKE_DATABASE_ONCHAIN,
        schema: !!process.env.SNOWFLAKE_SCHEMA_ONCHAIN,
        warehouse: !!process.env.SNOWFLAKE_WAREHOUSE,
        role: !!process.env.SNOWFLAKE_ROLE,
      }
    };
    
    return NextResponse.json({ 
      success: true, 
      connectionInfo 
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
} 