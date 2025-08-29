import useSWR from 'swr';

interface OHLCVData {
  DATE: string;
  OPEN: number;
  HIGH: number;
  LOW: number;
  CLOSE: number;
  VOLUME: number;
}

const fetcher = async (url: string): Promise<OHLCVData[]> => {
  const res = await fetch(url);
  const data = await res.json();
  
  // If the API returns an error object, throw an error instead of returning it
  if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
    throw new Error(data?.error || `HTTP error! status: ${res.status}`);
  }
  
  // Ensure we return an array
  return Array.isArray(data) ? data : [];
};

export function useOHLCV(days: number = 30) {
  const { data, error, isLoading, mutate } = useSWR<OHLCVData[]>(
    `/api/ohlcv?days=${days}`,
    fetcher,
    {
      refreshInterval: 300000, // Refresh every 5 minutes
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Dedupe requests within 1 minute
    }
  );

  // Get current price and calculate 24h change
  const currentPrice = data && data.length > 0 ? data[data.length - 1].CLOSE : null;
  const previousPrice = data && data.length > 1 ? data[data.length - 2].CLOSE : null;
  
  const priceChange = currentPrice && previousPrice 
    ? ((currentPrice - previousPrice) / previousPrice) * 100 
    : 0;

  const isPositive = priceChange >= 0;

  const refreshData = async () => {
    await mutate();
  };

  return {
    data,
    currentPrice,
    priceChange: {
      value: `${isPositive ? '+' : ''}${priceChange.toFixed(2)}%`,
      isPositive
    },
    isLoading,
    error,
    refreshData
  };
} 