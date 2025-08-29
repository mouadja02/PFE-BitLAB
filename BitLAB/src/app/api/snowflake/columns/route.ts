import { NextResponse } from 'next/server';
import { createPool } from '@/lib/snowflake';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get('table');

    if (!tableName) {
      return NextResponse.json(
        { error: 'Table name is required' },
        { status: 400 }
      );
    }

    console.log(`Connecting to Snowflake to fetch columns for table: ${tableName}...`);
    const pool = await createPool();
    
    const query = `
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'DATA'
      AND TABLE_CATALOG = 'BTC_DATA'
      AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;
    
    console.log(`Executing query for columns in table ${tableName}...`);
    const result = await pool.query(query, [tableName]);
    console.log(`Successfully fetched ${result.length} columns for table ${tableName}`);
    
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching columns:', error);
    
    // Provide more detailed error information
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch columns',
        details: errorMessage,
        code: errorCode
      },
      { status: 500 }
    );
  }
} 