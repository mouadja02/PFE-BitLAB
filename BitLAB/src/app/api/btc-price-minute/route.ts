import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Fetching Bitcoin minute price data from CryptoCompare...');
    
    const response = await fetch(
      'https://min-api.cryptocompare.com/data/v2/histominute?fsym=BTC&tsym=USD&limit=2&api_key=fb4f8e26d4a0fec6b05a9ae93d937f5697519d50a8f48d0f228901056c6d4bf5',
      {
        headers: {
          'Accept': 'application/json',
        },
        // Don't cache the request to ensure fresh data
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error(`CryptoCompare API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Successfully fetched Bitcoin minute price data');

    // Extract the latest close price from the data
    const latestData = data.Data.Data[data.Data.Data.length - 1];
    const previousData = data.Data.Data[data.Data.Data.length - 2];
    
    const currentPrice = latestData.close;
    console.log('Live price from CryptoCompare:', currentPrice);
    console.log('Latest data timestamp:', latestData.time);
    const previousPrice = previousData ? previousData.close : currentPrice;
    const priceChange = currentPrice - previousPrice;
    const priceChangePercent = previousPrice !== 0 ? (priceChange / previousPrice) * 100 : 0;

    const formattedResponse = {
      price: currentPrice.toString(), // Keep full precision, don't round
      change: {
        value: `${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`,
        isPositive: priceChangePercent >= 0
      },
      timestamp: latestData.time,
      volume: latestData.volumeto,
      high: latestData.high,
      low: latestData.low,
      open: latestData.open
    };

    console.log('Formatted response price:', formattedResponse.price);
    console.log('Price change:', formattedResponse.change.value);

    const nextResponse = NextResponse.json(formattedResponse);
    
    // Set optimized cache headers for real-time data
    nextResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    nextResponse.headers.set('Pragma', 'no-cache');
    nextResponse.headers.set('Expires', '0');
    
    return nextResponse;
  } catch (error) {
    console.error('Error fetching Bitcoin minute price data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Bitcoin minute price data' },
      { status: 500 }
    );
  }
} 