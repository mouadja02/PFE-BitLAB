import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = 'fb4f8e26d4a0fec6b05a9ae93d937f5697519d50a8f48d0f228901056c6d4bf5';
    const url = `https://min-api.cryptocompare.com/data/blockchain/balancedistribution/latest?fsym=BTC&api_key=${apiKey}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.Response !== 'Success') {
      throw new Error(data.Message || 'Failed to fetch balance distribution data');
    }

    return NextResponse.json(data.Data);
  } catch (error) {
    console.error('Error fetching balance distribution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance distribution data' },
      { status: 500 }
    );
  }
} 