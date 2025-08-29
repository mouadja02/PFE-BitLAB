import useSWR from 'swr';

interface FearGreedLiveData {
  currentValue: number;
  currentClass: string;
  yesterdayValue: number;
  lastWeekValue: number;
  rawData: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update?: string;
  }>;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useFearGreed() {
  const { data, error, isLoading, mutate } = useSWR<FearGreedLiveData>(
    '/api/fear-greed-live',
    fetcher
  );

  return {
    currentValue: data?.currentValue || null,
    currentClass: data?.currentClass || null,
    yesterdayValue: data?.yesterdayValue || null,
    lastWeekValue: data?.lastWeekValue || null,
    rawData: data?.rawData || [],
    isLoading,
    error
  };
} 