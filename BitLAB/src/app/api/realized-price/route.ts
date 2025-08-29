import { NextResponse } from 'next/server';
import { getMetricsData } from '@/lib/db/snowflake';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '30'; // Default to last 30 days

  try {
    console.log('Fetching realized price data from Snowflake...');
    
    const query = `
      SELECT 
        DATE,
        REALIZED_PRICE
      FROM BTC_DATA.DATA.REALIZED_PRICE 
      ORDER BY DATE DESC 
      LIMIT ${limit}
    `;

    const result = await getMetricsData(query);
    console.log(`Successfully fetched ${result?.length || 0} realized price records`);

    const formattedData = result.map((row: any) => ({
      date: row.DATE,
      realizedPrice: parseFloat(row.REALIZED_PRICE)
    }));

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching realized price data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch realized price data' },
      { status: 500 }
    );
  }
} 