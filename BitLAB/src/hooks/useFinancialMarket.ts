import useSWR from 'swr';

interface FinancialMarketData {
  date: string;
  nasdaq: number;
  gold: number;
  vix: number;
  dxy: number;
}

interface FinancialMarketResponse {
  success: boolean;
  data: FinancialMarketData[];
  count: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useFinancialMarket(limit: number = 30) {
  const { data, error, isLoading } = useSWR<FinancialMarketResponse>(
    `/api/financial-market?limit=${limit}`,
    fetcher,
    {
      refreshInterval: 300000, // Refresh every 5 minutes
      revalidateOnFocus: true, // Refresh on page focus
      dedupingInterval: 60000, // Dedupe requests within 1 minute
    }
  );

  return {
    data: data?.success ? data.data : [],
    isLoading,
    error: error || (!data?.success ? 'Failed to fetch financial market data' : null)
  };
} 