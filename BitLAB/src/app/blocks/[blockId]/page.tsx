"use client";

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { formatDistance } from 'date-fns';
import { ArrowLeft, Check, X } from 'lucide-react';

// This would be fetched from the API using the blockId parameter
const mockBlock = {
  BLOCK_NUMBER: 820000,
  BLOCK_HASH: '000000000000000000015293e57fa2f6b1abdd11fa27f5e7c6f5c7c2b5fc0771',
  BLOCK_TIMESTAMP: '2023-12-15T16:25:37Z',
  TX_COUNT: 1845,
  SIZE: 1452321,
  WEIGHT: 3998541,
  VERSION: 536870912,
  MERKLE_ROOT: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
  DIFFICULTY: 72348879840,
  NONCE: 123456789,
};

// Mock transactions for the block
const mockTransactions = Array(10).fill(null).map((_, i) => ({
  TX_ID: `a1b2c3d4e5f6${i}0123456789abcdef0123456789abcdef0123456789abcdef`,
  SIZE: Math.floor(Math.random() * 1000) + 200,
  FEE: Math.random() * 0.0005,
  IS_COINBASE: i === 0,
  INPUT_COUNT: i === 0 ? 1 : Math.floor(Math.random() * 5) + 1,
  OUTPUT_COUNT: Math.floor(Math.random() * 3) + 1,
}));

interface PageProps {
  params: {
    blockId: string;
  };
}

export default function BlockPage({ params }: PageProps) {
  const { blockId } = params;
  
  // Format block timestamp
  const blockDate = new Date(mockBlock.BLOCK_TIMESTAMP);
  const timeAgo = formatDistance(blockDate, new Date(), { addSuffix: true });
  
  // Format block size
  const formattedSize = (mockBlock.SIZE / 1024).toFixed(2);
  
  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/blocks" className="flex items-center text-bitcoin-orange hover:text-orange-600 mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Blocks
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Block #{mockBlock.BLOCK_NUMBER}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Mined {timeAgo}
        </p>
      </div>

      {/* Block Details */}
      <Card className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Block Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Hash</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 break-all">
                  {mockBlock.BLOCK_HASH}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Timestamp</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                  {new Date(mockBlock.BLOCK_TIMESTAMP).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Transactions</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                  {mockBlock.TX_COUNT.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Size</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                  {formattedSize} KB ({mockBlock.SIZE.toLocaleString()} bytes)
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Weight</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                  {mockBlock.WEIGHT.toLocaleString()} WU
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Version</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                  {mockBlock.VERSION.toString(16)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Merkle Root</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 break-all">
                  {mockBlock.MERKLE_ROOT}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Difficulty</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                  {mockBlock.DIFFICULTY.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Nonce</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                  {mockBlock.NONCE.toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>

      {/* Block Transactions */}
      <Card>
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Transactions ({mockBlock.TX_COUNT})
        </h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-bitcoin-gray">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Size
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Fee
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Coinbase
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Inputs / Outputs
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-bitcoin-dark divide-y divide-gray-200 dark:divide-gray-700">
              {mockTransactions.map((tx, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-bitcoin-gray">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-bitcoin-orange">
                    <Link href={`/block-explorer?type=transaction&query=${tx.TX_ID}`} className="hover:underline">
                      {tx.TX_ID.substring(0, 10)}...{tx.TX_ID.substring(tx.TX_ID.length - 10)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {tx.SIZE} bytes
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {tx.IS_COINBASE ? '-' : `${tx.FEE.toFixed(8)} BTC`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {tx.IS_COINBASE ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-red-500" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {tx.INPUT_COUNT} / {tx.OUTPUT_COUNT}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-3 flex justify-between items-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing 1-10 of {mockBlock.TX_COUNT} transactions
          </p>
          <div className="flex space-x-2">
            <button
              disabled
              className="px-3 py-1 rounded text-sm text-gray-400 bg-gray-100 dark:bg-bitcoin-gray cursor-not-allowed"
            >
              Previous
            </button>
            <button
              className="px-3 py-1 rounded text-sm text-white bg-bitcoin-orange hover:bg-orange-600"
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
} 