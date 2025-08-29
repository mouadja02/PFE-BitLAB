import { NextResponse } from 'next/server';
import { getMetricsData } from '@/lib/db/snowflake';

interface BTCHourlyData {
  UNIX_TIMESTAMP: number;
  DATE: string;
  HOUR_OF_DAY: number;
  OPEN: number;
  HIGH: number;
  CLOSE: number;
  LOW: number;
  VOLUME_FROM: number;
  VOLUME_TO: number;
  CREATED_AT: string;
}

interface ProcessedBTCData {
  timestamp: number;
  date: string;
  hour: number;
  open: number;
  high: number;
  close: number;
  low: number;
  volume: number;
  localTimestamp: number; // UTC+2 timestamp
}



// Convert UTC timestamp to UTC+2 (BitLAB timezone)
function convertToLocalTime(utcTimestamp: number): number {
  return utcTimestamp;  //+ (2 * 60 * 60);
}

// Process raw data from Snowflake
function processRawData(rawData: BTCHourlyData[]): ProcessedBTCData[] {
  return rawData.map(row => {
    const utcTimestamp = row.UNIX_TIMESTAMP;
    const localTimestamp = convertToLocalTime(utcTimestamp);
    
    return {
      timestamp: utcTimestamp, // Keep original UTC timestamp for filtering
      date: row.DATE,
      hour: row.HOUR_OF_DAY,
      open: row.OPEN,
      high: row.HIGH,
      close: row.CLOSE,
      low: row.LOW,
      volume: row.VOLUME_FROM,
      localTimestamp: localTimestamp // UTC+2 timestamp for display
    };
  });
}


// Fetch data from Snowflake
async function fetchFromSnowflake(hours: number): Promise<ProcessedBTCData[]> {
  const now = Date.now() / 1000; // Current time in seconds
  const cutoffTime = now - (hours * 3600); // N hours ago
  
  let query = `
    SELECT 
      UNIX_TIMESTAMP,
      DATE,
      HOUR_OF_DAY,
      OPEN,
      HIGH,
      CLOSE,
      LOW,
      VOLUME_FROM,
      VOLUME_TO,
      CREATED_AT
    FROM BTC_HOURLY_DATA
    WHERE UNIX_TIMESTAMP >= ${cutoffTime}
    ORDER BY UNIX_TIMESTAMP DESC
    LIMIT 2000
  `;
  
  console.log(`Fetching BTC hourly data for last ${hours} hours`);
  const rawData = await getMetricsData<BTCHourlyData>(query);
  
  return processRawData(rawData);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');
    
    // Fetch fresh data directly from Snowflake
    const data = await fetchFromSnowflake(hours);
    
    // Deduplicate based on timestamp (just in case)
    const deduplicatedMap = new Map();
    data.forEach(item => {
      deduplicatedMap.set(item.timestamp, item);
    });
    
    const uniqueData = Array.from(deduplicatedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`Fetched ${data.length} records, ${uniqueData.length} unique records`);
    
    const nextResponse = NextResponse.json({
      data: uniqueData,
      totalRecords: uniqueData.length,
      filteredRecords: uniqueData.length,
      status: 'fresh',
      lastUpdate: Date.now(),
      timezone: 'UTC+2',
      sampleLocalTime: uniqueData.length > 0 ? new Date(uniqueData[0].localTimestamp * 1000).toISOString() : null
    });
    
    // No caching - always fetch fresh data
    nextResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    nextResponse.headers.set('Pragma', 'no-cache');
    nextResponse.headers.set('Expires', '0');
    
    return nextResponse;
    
  } catch (error) {
    console.error('Error fetching BTC hourly data:', error);
    
    return NextResponse.json({
      totalRecords: 24,
      filteredRecords: 24,
              status: 'fallback',
      lastUpdate: Date.now(),
      timezone: 'UTC+2'
    }, { status: 206 });
  }
}

export async function DELETE(request: Request) {
  // No caching implemented
  return NextResponse.json({
    success: true,
    message: 'No caching to clear - data is always fetched fresh'
  });
} 