import { NextResponse } from 'next/server';
import { getMetricsData } from '@/lib/db/snowflake';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '30'; // Default to last 30 days

  try {
    console.log('Fetching onchain strategy data from Snowflake...');
    
    const query = `
      SELECT 
        DATE,
        MVRV,
        NUPL
      FROM BTC_DATA.DATA.ONCHAIN_STRATEGY 
      ORDER BY DATE DESC 
      LIMIT ${limit}
    `;

    const result = await getMetricsData(query);
    console.log(`Successfully fetched ${result?.length || 0} onchain strategy records`);

    const formattedData = result.map((row: any) => ({
      date: row.DATE,
      mvrv: parseFloat(row.MVRV),
      nupl: parseFloat(row.NUPL)
    }));

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching onchain strategy data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onchain strategy data' },
      { status: 500 }
    );
  }
} 