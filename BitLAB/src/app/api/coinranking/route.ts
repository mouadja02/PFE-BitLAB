import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const options = {
      headers: {
        'x-access-token': process.env.COINRANKING_API_KEY || '',
      },
    };
    
    const bitcoinUuid = "Qwsogvtv82FCd";
    const response = await fetch(`https://api.coinranking.com/v2/coin/${bitcoinUuid}/price`, options);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Bitcoin price: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.status === "success") {
      const rawPrice = parseFloat(result.data.price);
      const formattedPrice = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(rawPrice);
      
      // For demo purposes, generate a random 24h change
      const randomChange = (Math.random() * 10 - 5).toFixed(2);
      const isPositive = parseFloat(randomChange) >= 0;
      
      return NextResponse.json({
        price: formattedPrice,
        change: {
          value: `${isPositive ? '+' : ''}${randomChange}%`,
          isPositive: isPositive
        }
      });
    }
    
    throw new Error('Invalid response from Coinranking API');
  } catch (error) {
    console.error('Error fetching Bitcoin price:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Bitcoin price' },
      { status: 500 }
    );
  }
} 