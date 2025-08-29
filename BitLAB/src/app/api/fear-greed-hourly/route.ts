import { NextResponse } from 'next/server';
import { getMetricsData } from '@/lib/db/snowflake';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hours = searchParams.get('hours') || '24'; // Default to last 24 hours
  const limit = parseInt(hours);

  try {
    console.log('Fetching fear & greed hourly data from Snowflake...');
    
    const query = `
      SELECT 
        ANALYSIS_DATE AS DATE,
        TO_TIME(CONCAT(ANALYSIS_HOUR, ':00:00')) AS TIME,
        FEAR_GREED_SCORE AS SCORE,
        FEAR_GREED_CATEGORY AS FNG_CLASS
      FROM BTC_DATA.ANALYTICS.HOURLY_FNG 
      ORDER BY ANALYSIS_DATE DESC, ANALYSIS_HOUR DESC 
      LIMIT ${limit}
    `;

    const result = await getMetricsData(query);
    console.log(`Successfully fetched ${result?.length || 0} fear & greed records`);

    const formattedData = result.map((row: any) => {
      // Create a proper datetime string and convert to timestamp
      const dateTimeString = `${row.DATE}T${row.TIME}`;
      const timestamp = new Date(dateTimeString).getTime() / 1000;
      
      return {
        date: row.DATE,
        time: row.TIME,
        score: row.SCORE,
        classification: row.FNG_CLASS,
        timestamp: isNaN(timestamp) ? Date.now() / 1000 : timestamp
      };
    });

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching fear & greed hourly data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fear & greed hourly data' },
      { status: 500 }
    );
  }
} 