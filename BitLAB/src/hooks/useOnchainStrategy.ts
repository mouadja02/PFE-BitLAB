import useSWR from 'swr';

export interface OnchainStrategyData {
  date: string;
  mvrv: number;
  nupl: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const useOnchainStrategy = (limit: number = 30) => {
  const { data, error, isLoading } = useSWR<OnchainStrategyData[]>(
    `/api/onchain-strategy?limit=${limit}`,
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