import { NextResponse } from 'next/server';

interface TradingSignalData {
  category: string;
  sentiment: string;
  value: number;
  score: number;
  score_threshold_bearish: number;
  score_threshold_bullish: number;
}

interface TradingSignalsResponse {
  Response: string;
  Message: string;
  HasWarning: boolean;
  Type: number;
  RateLimit: object;
  Data: {
    id: number;
    time: number;
    symbol: string;
    partner_symbol: string;
    inOutVar: TradingSignalData;
    addressesNetGrowth: TradingSignalData;
    concentrationVar: TradingSignalData;
    largetxsVar: TradingSignalData;
  };
}

interface ProcessedTradingSignals {
  timestamp: number;
  signals: {
    inOutVar: TradingSignalData;
    addressesNetGrowth: TradingSignalData;
    concentrationVar: TradingSignalData;
    largetxsVar: TradingSignalData;
  };
}

export async function GET() {
  try {
    console.log('Fetching trading signals from CryptoCompare...');
    
    const response = await fetch(
      'https://min-api.cryptocompare.com/data/tradingsignals/intotheblock/latest?fsym=BTC&api_key=fb4f8e26d4a0fec6b05a9ae93d937f5697519d50a8f48d0f228901056c6d4bf5',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`CryptoCompare API error: ${response.status}`);
    }
    
    const data: TradingSignalsResponse = await response.json();
    
    if (data.Response !== 'Success') {
      throw new Error(`API returned error: ${data.Message}`);
    }
    
    const processedData: ProcessedTradingSignals = {
      timestamp: data.Data.time,
      signals: {
        inOutVar: data.Data.inOutVar,
        addressesNetGrowth: data.Data.addressesNetGrowth,
        concentrationVar: data.Data.concentrationVar,
        largetxsVar: data.Data.largetxsVar,
      }
    };
    
    console.log('Successfully fetched trading signals');
    
    return NextResponse.json({
      success: true,
      data: processedData
    });
    
  } catch (error) {
    console.error('Error fetching trading signals:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch trading signals',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 