import React from 'react';

export interface BTCDailyData {
  DATE: string;
  BTC_PRICE_USD: number;
}

export function useBTCDaily(timeframe: string = '1y') {
  console.log(`🎯 useBTCDaily: Hook called with timeframe: ${timeframe}`);
  const [data, setData] = React.useState<BTCDailyData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    console.log(`🚀 useBTCDaily: Starting fetch for timeframe: ${timeframe}`);
    setIsLoading(true);
    setError(null);
    
    try {
      const url = `/api/snowflake/btc-daily?timeframe=${timeframe}`;
      console.log(`📡 useBTCDaily: Fetching from ${url}`);
      
      const response = await fetch(url);
      const result = await response.json();
      console.log(`✅ useBTCDaily: Received ${result?.length} records`);
      
      setData(result);
    } catch (err) {
      console.error('❌ useBTCDaily: Error fetching BTC daily data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData([]); // Set empty data on error
    } finally {
      setIsLoading(false);
    }
  }, [timeframe]);

  React.useEffect(() => {
    // Temporary test: return some dummy data to test the chart
    console.log(`🧪 useBTCDaily: Testing with dummy data first`);
    setData([]);
    setIsLoading(false);
    
    // Also try the real fetch
    fetchData();
  }, [fetchData]);

  const refreshData = React.useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  console.log(`🔄 useBTCDaily: Current state - data length: ${data?.length || 0}, isLoading: ${isLoading}, error: ${error}`);
  return { data, isLoading, error, refreshData };
} 