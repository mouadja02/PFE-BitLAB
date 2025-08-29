import { NextResponse } from 'next/server';
import { createPool } from '@/lib/snowflake';

export async function GET(
  request: Request,
  { params }: { params: { hash: string } }
) {
  try {
    const blockHash = params.hash;
    
    if (!blockHash) {
      return NextResponse.json(
        { error: 'Invalid block hash' },
        { status: 400 }
      );
    }
    
    const pool = await createPool();
    
    const query = `
      SELECT 
        BLOCK_NUMBER,
        BLOCK_HASH,
        BLOCK_TIMESTAMP,
        TX_COUNT,
        SIZE,
        DIFFICULTY,
        MERKLE_ROOT,
        PREVIOUS_BLOCK_HASH,
        NEXT_BLOCK_HASH
      FROM 
        bitcoin_onchain_core_data.core.FACT_BLOCKS
      WHERE 
        BLOCK_HASH = ?
    `;
    
    const result = await pool.query(query, [blockHash]);
    
    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Block not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result[0], { status: 200 });
  } catch (error) {
    console.error('Error fetching block by hash:', error);
    return NextResponse.json(
      { error: 'Failed to fetch block' },
      { status: 500 }
    );
  }
} 