import { NextResponse } from 'next/server';
import { getMetricsData } from '@/lib/db/snowflake';

interface BTCDailyData {
  DATE: string;
  BTC_PRICE_USD: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '1m';

  // Define timeframe mappings
  const timeframeMap: { [key: string]: number } = {
    '1m': 30,
    '1y': 365,
    '3y': 1095,
    '10y': 3650
  };

  const days = timeframeMap[timeframe] || 30;

  try {
    // Build the SQL query
    const query = `
      SELECT DATE, CLOSE AS BTC_PRICE_USD
      FROM BTC_DATA.DATA.OHCLV_DATA
      WHERE DATE >= DATEADD(day, -${days}, CURRENT_DATE())
      ORDER BY DATE ASC
      LIMIT ${days}
    `;

    console.log(`Executing BTC daily query for ${days} days:`, query);

    // Use the shared getMetricsData function
    const result = await getMetricsData<BTCDailyData>(query);
    
    console.log(`BTC daily query returned ${result?.length || 0} rows`);


    // No caching - always fetch fresh data
    const nextResponse = NextResponse.json(result || []);
    nextResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    nextResponse.headers.set('Pragma', 'no-cache');
    nextResponse.headers.set('Expires', '0');
    
    return nextResponse;

  } catch (error) {
    console.error('Error fetching BTC daily data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch BTC daily data' },
      { status: 500 }
    );
  }
}