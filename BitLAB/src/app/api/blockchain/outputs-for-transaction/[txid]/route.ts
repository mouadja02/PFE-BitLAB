import { NextResponse } from 'next/server';
import { createPool } from '@/lib/snowflake';

export async function GET(
  request: Request,
  { params }: { params: { txid: string } }
) {
  try {
    const txId = params.txid;
    
    if (!txId) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }
    
    const pool = await createPool();
    
    const query = `
      SELECT 
        TX_ID,
        INDEX,
        VALUE,
        PUBKEY_SCRIPT_ADDRESS,
        PUBKEY_SCRIPT_TYPE
      FROM 
        bitcoin_onchain_core_data.core.FACT_OUTPUTS
      WHERE 
        TX_ID = ?
      ORDER BY 
        INDEX ASC
    `;
    
    const result = await pool.query(query, [txId]);
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error fetching outputs for transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction outputs' },
      { status: 500 }
    );
  }
} 