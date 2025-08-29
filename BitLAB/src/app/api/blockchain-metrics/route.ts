import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      'https://min-api.cryptocompare.com/data/blockchain/latest?fsym=BTC&api_key=04332ea0e83e70ad6830bd9d78a34a03d0d78a953752d87e1b7d3fce72288673'
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.Response !== 'Success' || !data.Data) {
      throw new Error('Invalid response from CryptoCompare API');
    }

    const metrics = data.Data;

    return NextResponse.json({
      timestamp: metrics.time,
      networkHashRate: metrics.hashrate,
      miningDifficulty: metrics.difficulty,
      bitcoinSupply: metrics.current_supply,
      activeAddresses: metrics.active_addresses,
      blockHeight: metrics.block_height,
      blockTime: metrics.block_time,
      transactionCount: metrics.transaction_count,
      averageTransactionValue: metrics.average_transaction_value
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error fetching blockchain metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blockchain metrics' },
      { status: 500 }
    );
  }
} 