import { NextResponse } from 'next/server';
import { getMetricsData } from '@/lib/db/snowflake';

interface FinancialMarketData {
  DATE: string;
  NASDAQ: number;
  GOLD: number;
  VIX: number;
  DXY: number;
}

interface ProcessedFinancialData {
  date: string;
  nasdaq: number;
  gold: number;
  vix: number;
  dxy: number;
}

// Process raw data from Snowflake
function processRawData(rawData: FinancialMarketData[]): ProcessedFinancialData[] {
  return rawData.map(row => ({
    date: row.DATE,
    nasdaq: row.NASDAQ,
    gold: row.GOLD,
    vix: row.VIX,
    dxy: row.DXY
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '30'; // Default to last 30 days
    
    console.log('Fetching financial market data from Snowflake...');
    
    const query = `
      SELECT 
        DATE,
        NASDAQ,
        GOLD,
        VIX,
        DXY
      FROM BTC_DATA.DATA.FINANCIAL_MARKET_DATA
      ORDER BY DATE DESC
      LIMIT ${limit}
    `;
    
    const rawData = await getMetricsData<FinancialMarketData>(query);
    const processedData = processRawData(rawData);
    
    // Reverse to get chronological order (oldest first)
    processedData.reverse();
    
    console.log(`Successfully fetched ${processedData.length} financial market data points`);
    
    return NextResponse.json({
      success: true,
      data: processedData,
      count: processedData.length
    });
    
  } catch (error) {
    console.error('Error fetching financial market data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch financial market data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 