import { NextResponse } from 'next/server';
import { createPool } from '@/lib/snowflake';

export async function GET(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address;
    
    if (!address) {
      return NextResponse.json(
        { error: 'Invalid address' },
        { status: 400 }
      );
    }
    
    const pool = await createPool();
    
    // Fetch transactions where this address appears in inputs or outputs
    const query = `
      SELECT DISTINCT
        t.TX_ID,
        t.BLOCK_NUMBER,
        t.BLOCK_TIMESTAMP,
        t.FEE,
        t.IS_COINBASE,
        t.INPUT_VALUE,
        t.OUTPUT_VALUE
      FROM 
        bitcoin_onchain_core_data.core.FACT_TRANSACTIONS t
      WHERE 
        t.TX_ID IN (
          SELECT DISTINCT TX_ID
          FROM bitcoin_onchain_core_data.core.FACT_OUTPUTS
          WHERE PUBKEY_SCRIPT_ADDRESS = ?
          UNION
          SELECT DISTINCT TX_ID
          FROM bitcoin_onchain_core_data.core.FACT_INPUTS
          WHERE PUBKEY_SCRIPT_ADDRESS = ?
        )
      ORDER BY 
        t.BLOCK_TIMESTAMP DESC
      LIMIT 50
    `;
    
    const result = await pool.query(query, [address, address]);
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error fetching transactions for address:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions for address' },
      { status: 500 }
    );
  }
} 