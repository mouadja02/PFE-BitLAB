import { NextResponse } from 'next/server';
import { createPool } from '@/lib/snowflake';

export async function GET(
  request: Request,
  { params }: { params: { number: string } }
) {
  try {
    const blockNumber = params.number;
    
    if (!blockNumber || isNaN(Number(blockNumber))) {
      return NextResponse.json(
        { error: 'Invalid block number' },
        { status: 400 }
      );
    }
    
    const pool = await createPool();
    
    const query = `
      SELECT 
        TX_ID,
        BLOCK_NUMBER,
        BLOCK_TIMESTAMP,
        INDEX,
        FEE,
        IS_COINBASE,
        INPUT_COUNT,
        OUTPUT_COUNT,
        INPUT_VALUE,
        OUTPUT_VALUE
      FROM 
        bitcoin_onchain_core_data.core.FACT_TRANSACTIONS
      WHERE 
        BLOCK_NUMBER = ?
      ORDER BY 
        INDEX ASC
      LIMIT 100
    `;
    
    const result = await pool.query(query, [blockNumber]);
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error fetching transactions for block:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
} 