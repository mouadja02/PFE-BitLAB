import useSWR from 'swr';

export interface BTCHourlyData {
  timestamp: number;
  date: string;
  hour: number;
  open: number;
  high: number;
  close: number;
  low: number;
  volume: number;
  localTimestamp: number;
}

interface BTCHourlyResponse {
  data: BTCHourlyData[];
  totalRecords: number;
}

const fetcher = async (url: string): Promise<BTCHourlyResponse> => {
  const res = await fetch(url);
  const data = await res.json();
  
  // If the API returns an error object, throw an error instead of returning it
  if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
    throw new Error(data?.error || `HTTP error! status: ${res.status}`);
  }
  
  // Ensure we return the expected structure
  if (!data || typeof data !== 'object' || !Array.isArray(data.data)) {
    return {
      data: [],
      totalRecords: 0
    };
  }
  
  return data;
};

export function useBTCHourly(hours: number = 24) {
  const { data, error, isLoading, mutate } = useSWR<BTCHourlyResponse>(
    `/api/btc-hourly?hours=${hours}`,
    fetcher
  );

  // Get current price and calculate change
  const currentPrice = data?.data && data.data.length > 0 ? data.data[0].close : null;
  const previousPrice = data?.data && data.data.length > 1 ? data.data[1].close : null;
  
  const priceChange = currentPrice && previousPrice 
    ? ((currentPrice - previousPrice) / previousPrice) * 100 
    : 0;

  const isPositive = priceChange >= 0;

  // Force refresh function
  const forceRefresh = () => {
    mutate();
  };

  return {
    data: data?.data || [],
    totalRecords: data?.totalRecords || 0,
    currentPrice,
    priceChange: {
      value: `${isPositive ? '+' : ''}${priceChange.toFixed(2)}%`,
      isPositive,
      raw: priceChange
    },
    isLoading,
    error,
    forceRefresh,
    refreshData: mutate
  };
} 