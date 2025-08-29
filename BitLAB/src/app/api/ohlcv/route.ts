import { NextResponse } from 'next/server';
import { getMetricsData } from '@/lib/db/snowflake';

interface OHLCVData {
  DATE: string;
  OPEN: number;
  HIGH: number;
  LOW: number;
  CLOSE: number;
  VOLUME: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '30';
    
    const query = `
      SELECT DATE, OPEN, HIGH, LOW, CLOSE, VOLUME
      FROM BTC_DATA.DATA.OHCLV_DATA
      WHERE DATE >= DATEADD(day, -${days}, CURRENT_DATE())
      ORDER BY DATE ASC
      LIMIT 365
    `;
    
    const data = await getMetricsData<OHLCVData>(query);
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800', // 30 minutes caching
      },
    });
  } catch (error) {
    console.error('Error fetching OHLCV data:', error);
    
    // Return sample data as fallback
    const sampleData = [
      {
        DATE: new Date().toISOString().split('T')[0],
        OPEN: 65000,
        HIGH: 66000,
        LOW: 64000,
        CLOSE: 65500,
        VOLUME: 1000000
      }
    ];
    
    return NextResponse.json(sampleData, { status: 206 });
  }
} 