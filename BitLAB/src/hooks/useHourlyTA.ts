import React from 'react';

export interface HourlyTAData {
  unix_timestamp: number;
  open: number;
  high: number;
  close: number;
  low: number;
  volume: number;
  datetime: string;
  sma_20: number;
  ema_12: number;
  ema_26: number;
  macd: number;
  macd_signal: number;
  macd_diff: number;
  rsi: number;
  bb_high: number;
  bb_low: number;
  bb_width: number;
  stoch_k: number;
  stoch_d: number;
  volume_sma: number;
  mfi: number;
  atr: number;
  price_change: number;
  high_low_ratio: number;
  close_open_ratio: number;
  volatility_30d: number;
  price_volatility_30d: number;
  hl_volatility_30d: number;
}

export interface UseHourlyTAResult {
  data: HourlyTAData[];
  isLoading: boolean;
  error: Error | null;
  metadata: {
    totalRows: number;
    lastUpdate: Date | null;
    timeRange: string;
  };
  forceRefresh: () => void;
}

// Helper functions for technical indicators
function calculateSMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(0);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

function calculateEMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      result.push(prices[i]);
    } else {
      result.push((prices[i] * multiplier) + (result[i - 1] * (1 - multiplier)));
    }
  }
  return result;
}

function calculateRSI(prices: number[], period: number = 14): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      result.push(50); // Default neutral RSI
    } else {
      const priceChanges = prices.slice(i - period, i).map((price, idx, arr) => 
        idx > 0 ? price - arr[idx - 1] : 0
      );
      
      const gains = priceChanges.filter(change => change > 0);
      const losses = priceChanges.filter(change => change < 0).map(loss => Math.abs(loss));
      
      const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
      const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      
      result.push(isNaN(rsi) ? 50 : rsi);
    }
  }
  return result;
}

export function useHourlyTA(
  limitHours: number = 168, // Default 7 days
  refreshInterval: number = 60000 // Default 1 minute refresh
): UseHourlyTAResult {
  const [data, setData] = React.useState<HourlyTAData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [metadata, setMetadata] = React.useState({
    totalRows: 0,
    lastUpdate: null as Date | null,
    timeRange: `${limitHours} hours`
  });

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Use the existing btc-hourly API
      const response = await fetch(`/api/btc-hourly?hours=${limitHours}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid data format received');
      }

      // Transform and calculate technical indicators
      const btcData = result.data;
      const closes = btcData.map((d: any) => d.close);
      const highs = btcData.map((d: any) => d.high);
      const lows = btcData.map((d: any) => d.low);
      const volumes = btcData.map((d: any) => d.volume);

      // Calculate indicators
      const sma20 = calculateSMA(closes, 20);
      const ema12 = calculateEMA(closes, 12);
      const ema26 = calculateEMA(closes, 26);
      const rsi = calculateRSI(closes, 14);
      const volumeSMA = calculateSMA(volumes, 20);

      // Transform the data to match our interface
      const transformedData: HourlyTAData[] = btcData.map((row: any, index: number) => ({
        unix_timestamp: row.timestamp,
        open: row.open || 0,
        high: row.high || 0,
        close: row.close || 0,
        low: row.low || 0,
        volume: row.volume || 0,
        datetime: new Date(row.timestamp * 1000).toISOString(),
        sma_20: sma20[index] || 0,
        ema_12: ema12[index] || 0,
        ema_26: ema26[index] || 0,
        macd: ema12[index] - ema26[index] || 0,
        macd_signal: 0, // Simplified for now
        macd_diff: 0, // Simplified for now
        rsi: rsi[index] || 50,
        bb_high: (sma20[index] || 0) * 1.02, // Simplified Bollinger Band (SMA + 2%)
        bb_low: (sma20[index] || 0) * 0.98, // Simplified Bollinger Band (SMA - 2%)
        bb_width: (sma20[index] || 0) * 0.04, // 4% width
        stoch_k: Math.random() * 100, // Placeholder
        stoch_d: Math.random() * 100, // Placeholder
        volume_sma: volumeSMA[index] || 0,
        mfi: Math.random() * 100, // Placeholder
        atr: (row.high - row.low) || 0, // Simplified ATR (just high-low)
        price_change: index > 0 ? ((row.close - btcData[index - 1].close) / btcData[index - 1].close) * 100 : 0,
        high_low_ratio: row.high / row.low || 1,
        close_open_ratio: row.close / row.open || 1,
        volatility_30d: Math.random() * 10, // Placeholder
        price_volatility_30d: Math.random() * 10, // Placeholder
        hl_volatility_30d: Math.random() * 10, // Placeholder
      }));

      setData(transformedData);
      setMetadata({
        totalRows: transformedData.length,
        lastUpdate: new Date(),
        timeRange: `${limitHours} hours`
      });

    } catch (err) {
      console.error('Error fetching hourly TA data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setIsLoading(false);
    }
  }, [limitHours]);

  const forceRefresh = React.useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Initial data fetch
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up refresh interval
  React.useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  return {
    data,
    isLoading,
    error,
    metadata,
    forceRefresh
  };
} 