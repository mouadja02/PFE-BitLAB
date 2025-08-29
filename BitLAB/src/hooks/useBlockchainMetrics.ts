import useSWR from 'swr';

interface BlockchainMetricsData {
  timestamp: number;
  networkHashRate: number;
  miningDifficulty: number;
  bitcoinSupply: number;
  activeAddresses: number;
  blockHeight: number;
  blockTime: number;
  transactionCount: number;
  averageTransactionValue: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useBlockchainMetrics() {
  const { data, error, isLoading, mutate } = useSWR<BlockchainMetricsData>(
    '/api/blockchain-metrics',
    fetcher
  );

  // Manual refresh function
  const refreshMetrics = async () => {
    try {
      await mutate();
    } catch (error) {
      console.error('Failed to refresh blockchain metrics:', error);
    }
  };

  return {
    networkHashRate: data?.networkHashRate || null,
    miningDifficulty: data?.miningDifficulty || null,
    bitcoinSupply: data?.bitcoinSupply || null,
    activeAddresses: data?.activeAddresses || null,
    blockHeight: data?.blockHeight || null,
    blockTime: data?.blockTime || null,
    transactionCount: data?.transactionCount || null,
    averageTransactionValue: data?.averageTransactionValue || null,
    timestamp: data?.timestamp || null,
    isLoading,
    error,
    refreshMetrics
  };
} 