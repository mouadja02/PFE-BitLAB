import useSWR from 'swr';

export interface BalanceDistributionItem {
  to: number;
  from: number;
  totalVolume: number;
  addressesCount: number;
}

export interface BalanceDistributionData {
  id: number;
  symbol: string;
  partner_symbol: string;
  time: number;
  balance_distribution: BalanceDistributionItem[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const useBalanceDistribution = () => {
  const { data, error, isLoading } = useSWR<BalanceDistributionData>(
    '/api/balance-distribution',
    fetcher,
    {
      refreshInterval: 300000, // Refresh every 5 minutes
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    data,
    isLoading,
    error,
  };
}; 