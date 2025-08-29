import useSWR from 'swr';

interface TradingSignalData {
  category: string;
  sentiment: string;
  value: number;
  score: number;
  score_threshold_bearish: number;
  score_threshold_bullish: number;
}

interface TradingSignals {
  timestamp: number;
  signals: {
    inOutVar: TradingSignalData;
    addressesNetGrowth: TradingSignalData;
    concentrationVar: TradingSignalData;
    largetxsVar: TradingSignalData;
  };
}

interface TradingSignalsResponse {
  success: boolean;
  data: TradingSignals;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useTradingSignals() {
  const { data, error, isLoading } = useSWR<TradingSignalsResponse>(
    '/api/trading-signals',
    fetcher,
    {
      refreshInterval: 300000, // Refresh every 5 minutes
      revalidateOnFocus: true, // Refresh on page focus
      dedupingInterval: 60000, // Dedupe requests within 1 minute
    }
  );

  return {
    data: data?.success ? data.data : null,
    isLoading,
    error: error || (!data?.success ? 'Failed to fetch trading signals' : null)
  };
} 