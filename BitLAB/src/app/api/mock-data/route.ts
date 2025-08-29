import { NextResponse } from 'next/server';

// Get today's date in ISO format (YYYY-MM-DD)
const getTodayDate = () => new Date().toISOString().split('T')[0];
const timestamp = Math.floor(Date.now() / 1000).toString();

// Add index signature to the mockData type
interface MockDataType {
  [key: string]: any[];
}

// Mock data that mimics the structure of the bitcoin-data.com API
const mockData: MockDataType = {
  'btc-price': [
    {
      d: getTodayDate(),
      unixTs: timestamp,
      btcPrice: '68421'
    }
  ],
  'hashrate': [
    {
      d: getTodayDate(),
      unixTs: timestamp,
      val: '540.5'
    }
  ],
  'difficulty-BTC': [
    {
      d: getTodayDate(),
      unixTs: timestamp,
      val: '72420000000000'
    }
  ],
  'bitcoin-dominance': [
    {
      d: getTodayDate(),
      unixTs: timestamp,
      pct: '52.8'
    }
  ],
  'puell-multiple': [
    {
      d: getTodayDate(),
      unixTs: timestamp,
      val: '1.23'
    }
  ],
  'supply-current': [
    {
      d: getTodayDate(),
      unixTs: timestamp,
      val: '19458321'
    }
  ],
  'mvrv': [
    {
      d: getTodayDate(),
      unixTs: timestamp,
      val: '2.34'
    }
  ],
  'nupl': [
    {
      d: getTodayDate(),
      unixTs: timestamp,
      val: '0.62'
    }
  ],
  'reserve-risk': [
    {
      d: getTodayDate(),
      unixTs: timestamp,
      val: '0.008'
    }
  ],
  'sopr': [
    {
      d: getTodayDate(),
      unixTs: timestamp,
      val: '1.05'
    }
  ]
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint');
  
  if (!endpoint) {
    return NextResponse.json(
      { error: 'No endpoint specified' },
      { status: 400 }
    );
  }
  
  // Extract the base endpoint without query parameters
  const baseEndpoint = endpoint.split('?')[0];
  
  if (mockData[baseEndpoint]) {
    console.log(`Serving mock data for: ${baseEndpoint}`);
    return NextResponse.json(mockData[baseEndpoint]);
  }
  
  return NextResponse.json(
    { error: 'Unknown endpoint' },
    { status: 404 }
  );
} 