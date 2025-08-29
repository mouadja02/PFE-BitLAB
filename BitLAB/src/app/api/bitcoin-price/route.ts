import { NextResponse } from 'next/server';
import { getBitcoinPrice, getCurrentBitcoinPrice } from '@/lib/api/bitcoin-price';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  
  try {
    if (date) {
      // Get price for specific date
      const priceData = await getBitcoinPrice(date);
      if (!priceData) {
        return NextResponse.json({ error: 'No data available for the specified date' }, { status: 404 });
      }
      return NextResponse.json(priceData);
    } else {
      // Get current price
      const currentPrice = await getCurrentBitcoinPrice();
      if (!currentPrice) {
        return NextResponse.json({ error: 'Failed to fetch current Bitcoin price' }, { status: 500 });
      }
      return NextResponse.json(currentPrice);
    }
  } catch (error) {
    console.error('Error in Bitcoin price API:', error);
    return NextResponse.json({ error: 'Failed to fetch Bitcoin price data' }, { status: 500 });
  }
} 