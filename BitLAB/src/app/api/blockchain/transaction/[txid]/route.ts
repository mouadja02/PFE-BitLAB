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
        BLOCK_NUMBER,
        BLOCK_TIMESTAMP,
        BLOCK_HASH,
        INDEX,
        TX_HASH,
        FEE,
        IS_COINBASE,
        COINBASE,
        INPUT_COUNT,
        OUTPUT_COUNT,
        INPUT_VALUE,
        INPUT_VALUE_SATS,
        OUTPUT_VALUE,
        OUTPUT_VALUE_SATS,
        SIZE,
        VIRTUAL_SIZE,
        WEIGHT,
        LOCK_TIME,
        VERSION,
        HEX,
        INPUTS,
        OUTPUTS,
        INSERTED_TIMESTAMP,
        MODIFIED_TIMESTAMP
      FROM 
        bitcoin_onchain_core_data.core.FACT_TRANSACTIONS
      WHERE 
        TX_ID = ?
    `;
    
    const result = await pool.query(query, [txId]);
    
    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }
    
    // Process any JSON fields in the result
    const transaction = result[0];
    
    // Parse the INPUTS JSON if it exists
    if (transaction.INPUTS && typeof transaction.INPUTS === 'string') {
      try {
        transaction.INPUTS = JSON.parse(transaction.INPUTS);
      } catch (e) {
        console.error('Error parsing INPUTS JSON:', e);
      }
    }
    
    // Parse the OUTPUTS JSON if it exists
    if (transaction.OUTPUTS && typeof transaction.OUTPUTS === 'string') {
      try {
        transaction.OUTPUTS = JSON.parse(transaction.OUTPUTS);
      } catch (e) {
        console.error('Error parsing OUTPUTS JSON:', e);
      }
    }
    
    return NextResponse.json(transaction, { status: 200 });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 }
    );
  }
} 