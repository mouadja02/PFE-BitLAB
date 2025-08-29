import useSWR from 'swr';

interface BitcoinPriceData {
  price: string;
  change: {
    value: string;
    isPositive: boolean;
  };
  timestamp: number;
  volume: number;
  high: number;
  low: number;
  open: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useBitcoinPrice() {
  const { data, error, isLoading, mutate } = useSWR<BitcoinPriceData>(
    '/api/btc-price-minute',
    fetcher
  );

  // Manual refresh function
  const refreshPrice = async () => {
    try {
      await mutate();
    } catch (error) {
      console.error('Failed to refresh price:', error);
    }
  };

  // Calculate time since last update
  const getTimeSinceUpdate = () => {
    if (!data?.timestamp) return null;
    const now = Date.now();
    const updateTime = data.timestamp * 1000; // Convert to milliseconds
    const diffSeconds = Math.floor((now - updateTime) / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return `${Math.floor(diffSeconds / 3600)}h ago`;
  };

  return {
    price: data?.price || null,
    priceChange: data?.change || { value: "+0.00%", isPositive: true },
    timestamp: data?.timestamp || null,
    volume: data?.volume || null,
    high: data?.high || null,
    low: data?.low || null,
    open: data?.open || null,
    timeSinceUpdate: getTimeSinceUpdate(),
    isLoading,
    error,
    refreshPrice
  };
} 