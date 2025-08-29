import { NextResponse } from 'next/server';
import { createPool } from '@/lib/snowflake';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const columns = searchParams.get('columns');
    const limit = searchParams.get('limit') || '1000'; // Default limit to 1000 rows
    
    if (!table) {
      return NextResponse.json(
        { error: 'Table name is required' },
        { status: 400 }
      );
    }

    if (!columns) {
      return NextResponse.json(
        { error: 'At least one column must be specified' },
        { status: 400 }
      );
    }

    // Sanitize inputs to prevent SQL injection
    const tablePattern = /^[A-Za-z0-9_]+$/;
    const columnsPattern = /^[A-Za-z0-9_,\s]+$/;
    const limitPattern = /^[0-9]+$/;

    if (!tablePattern.test(table)) {
      return NextResponse.json(
        { error: 'Invalid table name' },
        { status: 400 }
      );
    }

    if (!columnsPattern.test(columns)) {
      return NextResponse.json(
        { error: 'Invalid column names' },
        { status: 400 }
      );
    }

    if (!limitPattern.test(limit)) {
      return NextResponse.json(
        { error: 'Invalid limit value' },
        { status: 400 }
      );
    }

    console.log(`Connecting to Snowflake to fetch data from ${table}...`);
    process.env.SNOWFLAKE_DATABASE_ONCHAIN = 'BTC_DATA';
    process.env.SNOWFLAKE_SCHEMA_ONCHAIN = 'DATA';
    const pool = await createPool();
    
    const columnsArray = columns.split(',').map(col => col.trim());
    const columnsList = columnsArray.join(', ');
    
    const query = `
      SELECT ${columnsList}
      FROM "BTC_DATA"."DATA"."${table}"
      ORDER BY ${columnsArray[0]} -- Order by the first column, typically a date
      LIMIT ${limit}
    `;
    
    console.log(`Executing query for data from ${table}...`);
    console.log(`Query: ${query}`);
    const result = await pool.query(query);
    console.log(`Successfully fetched ${result.length} rows from ${table}`);
    
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching data:', error);
    
    // Provide more detailed error information
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch data',
        details: errorMessage,
        code: errorCode
      },
      { status: 500 }
    );
  }
} 