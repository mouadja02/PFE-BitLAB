'use client';

import React from 'react';
import BlockExplorer from '@/components/BlockExplorer';
import { useSearchParams } from 'next/navigation';

function BlockExplorerContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type');
  const query = searchParams.get('query');

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-white">Bitcoin Block Explorer</h1>
      <p className="mb-6 text-gray-400">
        Explore the Bitcoin blockchain with detailed information on blocks, transactions, and addresses.
        Data is sourced from the Snowflake bitcoin_onchain_core_data database.
        {query && type && <span className="ml-2">Currently viewing {type}: <strong className="text-bitcoin-orange">{query}</strong></span>}
      </p>
      
      <BlockExplorer />
    </div>
  );
}

export default function BlockExplorerPage() {
  return (
    <React.Suspense fallback={
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-6 text-white">Bitcoin Block Explorer</h1>
        <p className="mb-6 text-gray-400">
          Loading...
        </p>
      </div>
    }>
      <BlockExplorerContent />
    </React.Suspense>
  );
} 