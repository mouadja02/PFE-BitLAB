import useSWR from 'swr';

export interface RealizedPriceData {
  date: string;
  realizedPrice: number;
}

const fetcher = async (url: string): Promise<RealizedPriceData[]> => {
  const res = await fetch(url);
  const data = await res.json();
  
  // If the API returns an error object, throw an error instead of returning it
  if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
    throw new Error(data?.error || `HTTP error! status: ${res.status}`);
  }
  
  // Ensure we return an array
  return Array.isArray(data) ? data : [];
};

export const useRealizedPrice = (limit: number = 30) => {
  const { data, error, isLoading } = useSWR<RealizedPriceData[]>(
    `/api/realized-price?limit=${limit}`,
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