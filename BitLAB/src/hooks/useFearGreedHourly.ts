import useSWR from 'swr';

export interface FearGreedHourlyData {
  date: string;
  time: string;
  score: number;
  classification: string;
  timestamp: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const useFearGreedHourly = (hours: number = 24) => {
  const { data, error, isLoading } = useSWR<FearGreedHourlyData[]>(
    `/api/fear-greed-hourly?hours=${hours}`,
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