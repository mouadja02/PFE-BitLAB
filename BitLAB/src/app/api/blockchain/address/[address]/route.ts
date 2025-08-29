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
    
    // First check if the address is in the DIM_ENTITY_CLUSTERS
    const entityQuery = `
      SELECT 
        ADDRESS,
        PROJECT_NAME,
        ADDRESS_GROUP
      FROM 
        bitcoin_onchain_core_data.core.DIM_ENTITY_CLUSTERS
      WHERE 
        ADDRESS = ?
    `;
    
    const entityResult = await pool.query(entityQuery, [address]);
    
    // If found in clusters, return with entity info
    if (entityResult && entityResult.length > 0) {
      return NextResponse.json(entityResult[0], { status: 200 });
    }
    
    // Otherwise, check if it appears in any outputs
    const outputQuery = `
      SELECT 
        PUBKEY_SCRIPT_ADDRESS as ADDRESS,
        NULL as PROJECT_NAME,
        NULL as ADDRESS_GROUP
      FROM 
        bitcoin_onchain_core_data.core.FACT_OUTPUTS
      WHERE 
        PUBKEY_SCRIPT_ADDRESS = ?
      LIMIT 1
    `;
    
    const outputResult = await pool.query(outputQuery, [address]);
    
    if (outputResult && outputResult.length > 0) {
      return NextResponse.json(outputResult[0], { status: 200 });
    }
    
    return NextResponse.json(
      { error: 'Address not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching address information:', error);
    return NextResponse.json(
      { error: 'Failed to fetch address information' },
      { status: 500 }
    );
  }
} 