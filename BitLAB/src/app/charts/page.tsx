"use client";

import React from 'react';
import { Card } from '@/components/ui/Card';
import dynamic from 'next/dynamic';
import { 
  TrendingUp, 
  BarChart3, 
  Activity, 
  Database,
  Settings,
  Download,
  Maximize2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  LineChart,
  Calendar,
  Clock,
  DollarSign,
  Zap,
  Network,
  Cpu,
  Users,
  Plus,
  Minus
} from 'lucide-react';
import Chart from 'chart.js/auto';

// Dynamic import for Chart component to avoid SSR issues
const ChartComponent = dynamic(() => import('@/components/ui/Chart').then(mod => ({ default: mod.Chart })), { ssr: false });

// Dynamic import for Candlestick chart component
const AdvancedCandlestickChart = dynamic(() => import('@/components/ui/AdvancedCandlestickChart'), { ssr: false });

// Types for metrics and data
interface MetricCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  count: number;
  metrics: Metric[];
  expanded: boolean;
}

interface Metric {
  id: string;
  name: string;
  table: string;
  column: string;
  description: string;
  unit?: string;
  explanation: string;
  formula: string;
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    borderWidth: number;
    fill: boolean;
    yAxisID?: string;
  }>;
}

interface MovingAverage {
  period: number;
  type: 'SMA' | 'EMA';
  enabled: boolean;
}

// Chart configuration with adjusted limits based on timeframes
const TIMEFRAMES = [
  { id: 'all', label: 'All', days: null, limit: 10000 },
  { id: '5y', label: '5Y', days: 1825, limit: 1825 },
  { id: '3y', label: '3Y', days: 1095, limit: 1095 },
  { id: '1y', label: '1Y', days: 365, limit: 365 },
  { id: 'custom', label: 'Custom', days: 365, limit: 365 }
];

// Chart types are now automatically determined based on metric type

const SCALES = [
  { id: 'linear', label: 'Linear' },
  { id: 'logarithmic', label: 'Log' }
];

export default function ChartsPage() {
  // State management
  const [selectedMetric, setSelectedMetric] = React.useState<Metric | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = React.useState('1y');
  const [customPeriod, setCustomPeriod] = React.useState(30);
  // Chart type is now automatically determined based on metric type
  const getChartType = (metric?: Metric | null): 'line' | 'bar' | 'candlestick' => {
    if (!metric) return 'line';
    if (metric.id === 'ohlcv-candlestick') return 'candlestick';
    if (metric.id === 'btc-volume') return 'bar';
    return 'line';
  };
  
  const [selectedScale, setSelectedScale] = React.useState('linear'); // Left axis (metric)
  const [btcPriceScale, setBtcPriceScale] = React.useState('linear'); // Right axis (BTC price)
  const [chartData, setChartData] = React.useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [btcPriceData, setBtcPriceData] = React.useState<any[]>([]);
  const [showBtcPrice, setShowBtcPrice] = React.useState(true);
  const [candlestickData, setCandlestickData] = React.useState<any[] | null>(null);
  const [movingAverages, setMovingAverages] = React.useState<MovingAverage[]>([
    { period: 20, type: 'SMA', enabled: false },
    { period: 50, type: 'SMA', enabled: false },
    { period: 200, type: 'SMA', enabled: false }
  ]);

  // Metrics categories based on your Snowflake database
  const [metricCategories, setMetricCategories] = React.useState<MetricCategory[]>([
    {
      id: 'price-volume',
      name: 'Price & Volume',
      icon: <DollarSign size={16} />,
      count: 2,
      expanded: true,
      metrics: [
        {
          id: 'ohlcv-candlestick',
          name: 'Bitcoin OHLCV Candlestick',
          table: 'OHCLV_DATA',
          column: 'OHLCV',
          description: 'Complete OHLCV candlestick chart with volume',
          unit: 'USD',
          explanation: 'TradingView-style candlestick chart showing Open, High, Low, Close prices with volume bars. Perfect for technical analysis and identifying price patterns.',
          formula: 'OHLCV: Open, High, Low, Close prices with trading Volume'
        },
        {
          id: 'btc-volume',
          name: 'Trading Volume',
          table: 'OHCLV_DATA',
          column: 'VOLUME',
          description: 'Daily Bitcoin trading volume',
          unit: 'BTC',
          explanation: 'The total amount of Bitcoin traded during each day across exchanges.',
          formula: 'Sum of all Bitcoin trading volumes across exchanges per day'
        }
      ]
    },
    {
      id: 'on-chain-core',
      name: 'On-Chain Core Metrics',
      icon: <Activity size={16} />,
      count: 12,
      expanded: false,
      metrics: [
        {
          id: 'realized-price-core',
          name: 'Realized Price',
          table: 'BITCOIN_DATA',
          column: 'REALIZED_PRICE',
          description: 'Realized price from Bitcoin data',
          unit: 'USD',
          explanation: 'The realized price is the market cap divided by the circulating supply, weighted by when coins last moved.',
          formula: 'Realized Price = Realized Cap ÷ Circulating Supply'
        },
        {
          id: 'mvrv-core',
          name: 'MVRV Ratio',
          table: 'BITCOIN_DATA',
          column: 'MVRV',
          description: 'Market Value to Realized Value ratio from Bitcoin data',
          unit: 'Ratio',
          explanation: 'MVRV compares Bitcoin\'s market cap to its realized cap. Values above 1 indicate average holders are in profit. Historically, MVRV > 3.7 indicates market tops, MVRV < 1 indicates bottoms.',
          formula: 'MVRV = Market Cap ÷ Realized Cap'
        },
        {
          id: 'nupl-core',
          name: 'NUPL (Net Unrealized P&L)',
          table: 'BITCOIN_DATA',
          column: 'NUPL',
          description: 'Net Unrealized Profit/Loss from Bitcoin data',
          unit: 'Ratio',
          explanation: 'NUPL shows whether the network is in profit or loss. Values > 0.75 indicate euphoria, < 0.25 indicate fear/capitulation.',
          formula: 'NUPL = (Market Cap - Realized Cap) ÷ Market Cap'
        },

        {
          id: 'supply-current',
          name: 'Current Supply',
          table: 'BITCOIN_DATA',
          column: 'SUPPLY_CURRENT',
          description: 'Current Bitcoin supply in circulation',
          unit: 'BTC',
          explanation: 'The total amount of Bitcoin currently in circulation.',
          formula: 'Total Bitcoin mined and available in circulation'
        },
        {
          id: 'cdd-90dma',
          name: 'CDD 90-Day Moving Average',
          table: 'BITCOIN_DATA',
          column: 'CDD_90DMA',
          description: '90-day moving average of Coin Days Destroyed',
          unit: 'CDD',
          explanation: 'Smoothed version of Coin Days Destroyed over 90 days, reducing noise to show long-term trends.',
          formula: '90-day moving average of daily CDD values'
        },
        {
          id: 'nvt-ratio',
          name: 'NVT Ratio',
          table: 'BITCOIN_DATA',
          column: 'NVT_RATIO',
          description: 'Network Value to Transaction ratio',
          unit: 'Ratio',
          explanation: 'NVT compares Bitcoin\'s market cap to transaction volume, similar to P/E ratio for stocks.',
          formula: 'NVT = Market Cap ÷ Daily Transaction Volume'
        },
        {
          id: 'puell-multiple-core',
          name: 'Puell Multiple',
          table: 'BITCOIN_DATA',
          column: 'PUELL_MULTIPLE',
          description: 'Daily coin issuance value vs MA',
          unit: 'Multiple',
          explanation: 'Puell Multiple shows when miners receive unusually high/low revenue vs historical average.',
          formula: 'Daily Coin Issuance Value ÷ 365-Day MA'
        },
        {
          id: 'reserve-risk',
          name: 'Reserve Risk',
          table: 'BITCOIN_DATA',
          column: 'RESERVE_RISK',
          description: 'Long-term holder confidence vs price',
          unit: 'Risk Score',
          explanation: 'Reserve Risk identifies attractive Bitcoin accumulation opportunities by comparing price to hodler confidence.',
          formula: 'Price ÷ HODL Bank (confidence of long-term holders)'
        },
        {
          id: 'hashrate',
          name: 'Hash Rate',
          table: 'BITCOIN_DATA',
          column: 'HASHRATE',
          description: 'Bitcoin network hash rate',
          unit: 'H/s',
          explanation: 'The total computational power securing the Bitcoin network.',
          formula: 'Total hash rate of all miners on the Bitcoin network'
        },
        {
          id: 'lth-sopr',
          name: 'Long-Term Holder SOPR',
          table: 'SOPR_HOLDERS',
          column: 'LTH_SOPR',
          description: 'SOPR for long-term holders (>155 days)',
          unit: 'Ratio',
          explanation: 'SOPR specifically for coins held longer than 155 days.',
          formula: 'SOPR calculated only for coins with age > 155 days'
        },
        {
          id: 'sth-sopr',
          name: 'Short-Term Holder SOPR',
          table: 'SOPR_HOLDERS',
          column: 'STH_SOPR',
          description: 'SOPR for short-term holders (<155 days)',
          unit: 'Ratio',
          explanation: 'SOPR specifically for coins held less than 155 days.',
          formula: 'SOPR calculated only for coins with age < 155 days'
        }
      ]
    },
    {
      id: 'technical-indicators',
      name: 'Technical Analysis',
      icon: <TrendingUp size={16} />,
      count: 15,
      expanded: false,
      metrics: [
        {
          id: 'rsi',
          name: 'RSI (Relative Strength Index)',
          table: 'HOURLY_TA',
          column: 'RSI',
          description: 'Momentum oscillator (0-100)',
          unit: 'Index',
          explanation: 'RSI measures momentum. Values > 70 suggest overbought conditions, < 30 suggest oversold conditions.',
          formula: 'RSI = 100 - (100 / (1 + RS)) where RS = Average Gain / Average Loss'
        },
        {
          id: 'macd',
          name: 'MACD',
          table: 'HOURLY_TA',
          column: 'MACD',
          description: 'Moving Average Convergence Divergence',
          unit: 'Price',
          explanation: 'MACD shows the relationship between two moving averages. Bullish when MACD crosses above signal line.',
          formula: 'MACD = EMA(12) - EMA(26)'
        },
        {
          id: 'macd-signal',
          name: 'MACD Signal Line',
          table: 'HOURLY_TA',
          column: 'MACD_SIGNAL',
          description: 'MACD signal line (EMA of MACD)',
          unit: 'Price',
          explanation: 'Signal line for MACD crossover signals.',
          formula: 'EMA(9) of MACD values'
        },
        {
          id: 'bb-high',
          name: 'Bollinger Band Upper',
          table: 'HOURLY_TA',
          column: 'BB_HIGH',
          description: 'Upper Bollinger Band',
          unit: 'USD',
          explanation: 'Upper boundary of price volatility. Prices touching this band may indicate overbought conditions.',
          formula: 'SMA(20) + (2 × Standard Deviation)'
        },
        {
          id: 'bb-low',
          name: 'Bollinger Band Lower',
          table: 'HOURLY_TA',
          column: 'BB_LOW',
          description: 'Lower Bollinger Band',
          unit: 'USD',
          explanation: 'Lower boundary of price volatility. Prices touching this band may indicate oversold conditions.',
          formula: 'SMA(20) - (2 × Standard Deviation)'
        },
        {
          id: 'bb-width',
          name: 'Bollinger Band Width',
          table: 'HOURLY_TA',
          column: 'BB_WIDTH',
          description: 'Width between Bollinger Bands',
          unit: 'USD',
          explanation: 'Measures market volatility. Narrow bands indicate low volatility, wide bands indicate high volatility.',
          formula: '(Upper Band - Lower Band) / Middle Band'
        },
        {
          id: 'sma-20',
          name: 'SMA 20',
          table: 'HOURLY_TA',
          column: 'SMA_20',
          description: '20-period Simple Moving Average',
          unit: 'USD',
          explanation: 'Short-term trend indicator. Price above SMA indicates uptrend, below indicates downtrend.',
          formula: 'Sum of last 20 prices / 20'
        },
        {
          id: 'ema-12',
          name: 'EMA 12',
          table: 'HOURLY_TA',
          column: 'EMA_12',
          description: '12-period Exponential Moving Average',
          unit: 'USD',
          explanation: 'Fast EMA used in MACD calculation. More responsive to recent price changes.',
          formula: 'EMA = (Price × 2/(n+1)) + (Previous EMA × (1-2/(n+1)))'
        },
        {
          id: 'ema-26',
          name: 'EMA 26',
          table: 'HOURLY_TA',
          column: 'EMA_26',
          description: '26-period Exponential Moving Average',
          unit: 'USD',
          explanation: 'Slow EMA used in MACD calculation.',
          formula: 'EMA with 26-period smoothing factor'
        },
        {
          id: 'stoch-k',
          name: 'Stochastic %K',
          table: 'HOURLY_TA',
          column: 'STOCH_K',
          description: 'Stochastic oscillator %K line',
          unit: '%',
          explanation: 'Momentum indicator showing price position relative to high-low range.',
          formula: '%K = (Current Price - Lowest Low) / (Highest High - Lowest Low) × 100'
        },
        {
          id: 'stoch-d',
          name: 'Stochastic %D',
          table: 'HOURLY_TA',
          column: 'STOCH_D',
          description: 'Stochastic oscillator %D line (signal)',
          unit: '%',
          explanation: 'Signal line for Stochastic oscillator crossovers.',
          formula: '%D = 3-period moving average of %K'
        },
        {
          id: 'atr',
          name: 'ATR (Average True Range)',
          table: 'HOURLY_TA',
          column: 'ATR',
          description: 'Average True Range volatility indicator',
          unit: 'USD',
          explanation: 'Measures market volatility. Higher ATR indicates higher volatility.',
          formula: 'ATR = MA of True Range over specified period'
        },
        {
          id: 'mfi',
          name: 'MFI (Money Flow Index)',
          table: 'HOURLY_TA',
          column: 'MFI',
          description: 'Volume-weighted RSI',
          unit: 'Index',
          explanation: 'Combines price and volume. Values > 80 suggest overbought, < 20 suggest oversold.',
          formula: 'MFI = 100 - (100 / (1 + Money Flow Ratio))'
        },
        {
          id: 'volatility-30d',
          name: '30-Day Price Volatility',
          table: 'HOURLY_TA',
          column: 'VOLATILITY_30D',
          description: '30-day price volatility',
          unit: '%',
          explanation: 'Measures price volatility over the past 30 days.',
          formula: 'Standard deviation of price changes over 30 days'
        },
        {
          id: 'volume-sma',
          name: 'Volume SMA',
          table: 'HOURLY_TA',
          column: 'VOLUME_SMA',
          description: 'Volume Simple Moving Average',
          unit: 'BTC',
          explanation: 'Average trading volume over specified period.',
          formula: 'Simple moving average of trading volume'
        }
      ]
    },
    {
      id: 'market-psychology',
      name: 'Market Psychology',
      icon: <Users size={16} />,
      count: 4,
      expanded: false,
      metrics: [
        {
          id: 'fear-greed-hourly',
          name: 'Fear & Greed Score (Hourly)',
          table: 'ANALYTICS.HOURLY_FNG',
          column: 'FEAR_GREED_SCORE',
          description: 'Hourly Fear & Greed Index score',
          unit: 'Score (0-100)',
          explanation: 'Measures market sentiment. 0 = Extreme Fear, 100 = Extreme Greed. Based on multiple market factors.',
          formula: 'Composite score from volatility, momentum, social media, surveys, dominance, and trends'
        },
        {
          id: 'fear-greed-daily',
          name: 'Fear & Greed Score (Daily)',
          table: 'ANALYTICS.DAILY_FNG',
          column: 'DAILY_FEAR_GREED_SCORE',
          description: 'Daily Fear & Greed Index score',
          unit: 'Score (0-100)',
          explanation: 'Daily aggregated market sentiment indicator.',
          formula: 'Daily average of hourly Fear & Greed scores'
        },
        {
          id: 'sentiment-hourly',
          name: 'Sentiment Score (Hourly)',
          table: 'ANALYTICS.HOURLY_FNG',
          column: 'AVG_SENTIMENT_SCORE',
          description: 'Average sentiment from news analysis',
          unit: 'Score',
          explanation: 'Sentiment analysis of Bitcoin-related news and social media.',
          formula: 'Average sentiment score from analyzed articles and posts'
        },
        {
          id: 'sentiment-daily',
          name: 'Sentiment Score (Daily)',
          table: 'ANALYTICS.DAILY_FNG',
          column: 'AVG_SENTIMENT_SCORE',
          description: 'Daily average sentiment score',
          unit: 'Score',
          explanation: 'Daily aggregated sentiment from news and social analysis.',
          formula: 'Daily average of hourly sentiment scores'
        }
      ]
    },
    {
      id: 'network-security',
      name: 'Network & Security',
      icon: <Network size={16} />,
      count: 2,
      expanded: false,
      metrics: [
        {
          id: 'network-difficulty',
          name: 'Network Difficulty',
          table: 'NETWORK_DIFFICULTY',
          column: 'AVG_DIFFICULTY',
          description: 'Bitcoin mining difficulty',
          unit: 'Difficulty',
          explanation: 'Measure of how hard it is to find a new block. Higher difficulty = more mining power.',
          formula: 'Adjusts every 2016 blocks to maintain 10-minute block time'
        },
        {
          id: 'out-flows',
          name: 'Network Outflows',
          table: 'BITCOIN_DATA',
          column: 'OUT_FLOWS',
          description: 'Bitcoin outflows from network',
          unit: 'BTC',
          explanation: 'Amount of Bitcoin flowing out of tracked addresses.',
          formula: 'Sum of Bitcoin moving out of monitored address clusters'
        }
      ]
    },
    {
      id: 'traditional-markets',
      name: 'Traditional Markets',
      icon: <Cpu size={16} />,
      count: 4,
      expanded: false,
      metrics: [
        {
          id: 'nasdaq',
          name: 'NASDAQ Index',
          table: 'FINANCIAL_MARKET_DATA',
          column: 'NASDAQ',
          description: 'NASDAQ composite index',
          unit: 'Index',
          explanation: 'Technology-heavy stock market index for correlation analysis with Bitcoin.',
          formula: 'NASDAQ Composite Index value'
        },
        {
          id: 'vix',
          name: 'VIX (Volatility Index)',
          table: 'FINANCIAL_MARKET_DATA',
          column: 'VIX',
          description: 'CBOE Volatility Index',
          unit: 'Index',
          explanation: 'Fear gauge of the stock market. Higher VIX indicates more fear/uncertainty.',
          formula: 'Implied volatility of S&P 500 index options'
        },
        {
          id: 'dxy',
          name: 'US Dollar Index (DXY)',
          table: 'FINANCIAL_MARKET_DATA',
          column: 'DXY',
          description: 'US Dollar strength index',
          unit: 'Index',
          explanation: 'Measures USD strength against basket of major currencies. Often inversely correlated with Bitcoin.',
          formula: 'Weighted geometric mean of USD vs basket of currencies'
        },
        {
          id: 'gold',
          name: 'Gold Price',
          table: 'FINANCIAL_MARKET_DATA',
          column: 'GOLD',
          description: 'Gold spot price',
          unit: 'USD/oz',
          explanation: 'Traditional store of value often compared to Bitcoin as digital gold.',
          formula: 'Spot price of gold per troy ounce'
        }
      ]
    }
  ]);

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setMetricCategories((prev: MetricCategory[]) => 
      prev.map((cat: MetricCategory) => 
        cat.id === categoryId 
          ? { ...cat, expanded: !cat.expanded }
          : cat
      )
    );
  };

  // Calculate moving averages
  const calculateMovingAverage = (data: number[], period: number, type: 'SMA' | 'EMA'): number[] => {
    if (type === 'SMA') {
      return data.map((_, index) => {
        if (index < period - 1) return NaN;
        const slice = data.slice(index - period + 1, index + 1);
        return slice.reduce((sum, val) => sum + val, 0) / period;
      });
    } else {
      // EMA calculation
      const multiplier = 2 / (period + 1);
      const ema = [data[0]];
      for (let i = 1; i < data.length; i++) {
        ema[i] = (data[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
      }
      return ema;
    }
  };

  // Select metric and fetch data
  const selectMetric = async (metric: Metric) => {
    setSelectedMetric(metric);
    setIsLoading(true);
    setError(null);
    setCandlestickData(null); // Clear candlestick data

    // Chart type is now automatically determined by getChartType() function

    try {
      const timeframeConfig = TIMEFRAMES.find(tf => tf.id === selectedTimeframe);
      const actualDays = selectedTimeframe === 'custom' ? customPeriod : timeframeConfig?.days;
      const actualLimit = selectedTimeframe === 'custom' ? customPeriod : timeframeConfig?.limit;
      
      // Determine if we need BTC price overlay
      const isPriceMetric = metric.id === 'ohlcv-candlestick'; // Only candlestick is a price metric
      const isVolumeMetric = metric.id === 'btc-volume'; // Volume always shows with BTC price
      const needsBtcPrice = (showBtcPrice && !isPriceMetric) || isVolumeMetric;
      
      // Fetch data with optional BTC price join
      const metricResponse = await fetch(
        `/api/snowflake/chart-data?table=${metric.table}&column=${metric.column}&timeframe=${selectedTimeframe}&days=${actualDays}&limit=${actualLimit}&includeBtcPrice=${needsBtcPrice}`
      );
      
      let metricData;
      if (metricResponse.ok) {
        metricData = await metricResponse.json();
      } else {
        throw new Error('Failed to fetch chart data');
      }

      // Handle OHLCV candlestick data
      if (metric.id === 'ohlcv-candlestick') {
        // Transform data for candlestick chart
        const candlestickFormattedData = metricData.map((item: any) => {
          // Convert date string to Unix timestamp in seconds
          const dateObj = new Date(item.DATE);
          const timestamp = Math.floor(dateObj.getTime() / 1000);
          
          return {
            timestamp: timestamp,
            localTimestamp: timestamp, // Use same timestamp for local
            open: parseFloat(item.OPEN || 0),
            high: parseFloat(item.HIGH || 0),
            low: parseFloat(item.LOW || 0),
            close: parseFloat(item.CLOSE || 0),
            volume: parseFloat(item.VOLUME || 0),
          };
        });
        
        setCandlestickData(candlestickFormattedData);
        setChartData(null); // Clear regular chart data
        return;
      }
      
      // Transform data for Chart.js
      const datasets: any[] = [];
      
      // Main metric dataset
      let mainData = metricData.map((item: any) => parseFloat(item[metric.column] || 0));
      
      // Filter out zero/negative values for logarithmic scale
      if (selectedScale === 'logarithmic') {
        mainData = mainData.map((value: number) => Math.max(value, 1));
      }
      
      // Use appropriate colors for different metrics
      const getMetricColor = (metricId: string) => {
        switch (metricId) {
          case 'btc-volume':
            return '#10b981'; // Green for volume
          case 'ohlcv-candlestick':
            return '#F7931A'; // Orange for price (won't be used but kept for consistency)
          default:
            return '#3b82f6'; // Blue for other metrics
        }
      };
      
      const metricColor = getMetricColor(metric.id);
      
      datasets.push({
        label: metric.name,
        data: mainData,
        borderColor: metricColor,
        backgroundColor: getChartType(metric) === 'line' ? `${metricColor}20` : `${metricColor}50`,
        borderWidth: 2,
        fill: getChartType(metric) === 'line' ? false : true,
        yAxisID: isPriceMetric ? 'y1' : 'y', // Price metrics go on right axis (y1), others on left (y)
        pointRadius: getChartType(metric) === 'line' ? 0 : 3,
        pointHoverRadius: getChartType(metric) === 'line' ? 4 : 6,
        tension: getChartType(metric) === 'line' ? 0.1 : 0
      });

      // Add moving averages if enabled (on same axis as main metric)
      movingAverages.forEach((ma, index) => {
        if (ma.enabled) {
          const maData = calculateMovingAverage(mainData, ma.period, ma.type);
          const maColors = ['#ef4444', '#10b981', '#8b5cf6', '#f59e0b'];
          datasets.push({
            label: `${ma.type}(${ma.period})`,
            data: maData,
            borderColor: maColors[index % maColors.length],
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            fill: false,
            yAxisID: isPriceMetric ? 'y1' : 'y',
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.1,
            borderDash: ma.type === 'EMA' ? [5, 5] : undefined
          });
        }
      });

      // Add BTC price overlay if enabled and not a price metric
      if (needsBtcPrice && metricData.length > 0) {
        let btcPrices;
        
        // Try to get BTC price from JOIN or fetch separately
        if (metricData[0].BTC_PRICE_USD !== undefined) {
          btcPrices = metricData.map((item: any) => parseFloat(item.BTC_PRICE_USD || 0));
        } else if (metricData[0].CLOSE !== undefined) {
          btcPrices = metricData.map((item: any) => parseFloat(item.CLOSE || 0));
        } else {
          // Fallback: fetch BTC price separately
          try {
            const btcResponse = await fetch(
              `/api/snowflake/chart-data?table=OHCLV_DATA&column=CLOSE&timeframe=${selectedTimeframe}&days=${actualDays}&limit=${actualLimit}&includeBtcPrice=false`
            );
            if (btcResponse.ok) {
              const btcData = await btcResponse.json();
              btcPrices = btcData.map((item: any) => parseFloat(item.CLOSE || 0));
            }
          } catch (btcError) {
            console.warn('Could not fetch BTC price overlay:', btcError);
          }
        }
        
        if (btcPrices && btcPrices.length > 0) {
        // Filter out zero/negative values for logarithmic scale
        if (btcPriceScale === 'logarithmic') {
          btcPrices = btcPrices.map((value: number) => Math.max(value, 1));
        }
        
        datasets.push({
          label: 'BTC Price (USD)',
          data: btcPrices,
            borderColor: '#F7931A',
          backgroundColor: 'transparent',
            borderWidth: 2,
          fill: false,
          yAxisID: 'y1',
          pointRadius: 0,
          pointHoverRadius: 3,
            tension: 0.1,
            borderDash: [3, 3]
        });
        
        // Store BTC price data for reference
        setBtcPriceData(metricData);
        }
      }

      const chartData: ChartData = {
        labels: metricData.map((item: any) => {
          // Handle different date column names
          const dateValue = item.DATE || item.date || item.DATETIME || item.datetime;
          const date = new Date(dateValue);
          return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
          });
        }),
        datasets
      };

      setChartData(chartData);
    } catch (err: any) {
      console.error('Error fetching chart data:', err);
      setError(err.message);
      
      // Generate sample data for demonstration
      const sampleData = generateSampleData(metric);
      setChartData(sampleData);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate sample data for demonstration
  const generateSampleData = (metric: Metric): ChartData => {
    const timeframeConfig = TIMEFRAMES.find(tf => tf.id === selectedTimeframe);
    const actualDays = selectedTimeframe === 'custom' ? customPeriod : (timeframeConfig?.days || 365);
    const actualLimit = selectedTimeframe === 'custom' ? customPeriod : (timeframeConfig?.limit || 1000);
    const dataPoints = Math.min(actualDays || 1825, actualLimit); // Default to 5 years for "All"
    
    // Handle OHLCV candlestick sample data
    if (metric.id === 'ohlcv-candlestick') {
      const sampleCandlestickData = Array.from({ length: dataPoints }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (dataPoints - i));
        const timestamp = Math.floor(date.getTime() / 1000); // Convert to Unix timestamp in seconds
        
        const basePrice = 45000 + Math.sin(i / 30) * 10000; // Trend over time
        const dailyVolatility = 0.02 + Math.random() * 0.03; // 2-5% daily volatility
        
        const open = basePrice + (Math.random() - 0.5) * basePrice * dailyVolatility;
        const close = open + (Math.random() - 0.5) * open * dailyVolatility;
        const high = Math.max(open, close) + Math.random() * Math.abs(open - close);
        const low = Math.min(open, close) - Math.random() * Math.abs(open - close);
        const volume = 500 + Math.random() * 2000; // BTC volume
        
        return {
          timestamp: timestamp,
          localTimestamp: timestamp, // Use same timestamp for local
          open: Math.max(1, open),
          high: Math.max(1, high),
          low: Math.max(1, low),
          close: Math.max(1, close),
          volume: Math.max(1, volume)
        };
      });
      
      setCandlestickData(sampleCandlestickData);
      return { labels: [], datasets: [] }; // Return empty since we use candlestick data
    }
    
    const labels = Array.from({ length: dataPoints }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (dataPoints - i));
      return date.toLocaleDateString();
    });

    // Generate realistic sample data based on metric type
    let baseValue = 50000;
    let volatility = 0.02;
    
    if (metric.id === 'btc-volume') {
      baseValue = 1000;
      volatility = 0.15;
    } else if (metric.id === 'market-cap') {
      baseValue = 900000000000;
      volatility = 0.025;
    } else if (metric.id === 'mvrv') {
      baseValue = 2.5;
      volatility = 0.1;
    }

    let mainData = labels.map((_, i) => {
      const trend = Math.sin(i / 10) * 0.1;
      const noise = (Math.random() - 0.5) * volatility;
      return Math.max(baseValue * (1 + trend + noise), 1); // Ensure minimum value of 1
    });

    // Filter out zero/negative values for logarithmic scale
    if (selectedScale === 'logarithmic') {
      mainData = mainData.map((value: number) => Math.max(value, 1));
    }

    // Use appropriate colors for sample data
    const getMetricColor = (metricId: string) => {
      switch (metricId) {
        case 'btc-volume':
          return '#10b981'; // Green for volume
        case 'ohlcv-candlestick':
          return '#F7931A'; // Orange for price
        default:
          return '#3b82f6'; // Blue for other metrics
      }
    };
    
    const metricColor = getMetricColor(metric.id);

    const datasets: any[] = [{
      label: metric.name,
      data: mainData,
      borderColor: metricColor,
      backgroundColor: getChartType(metric) === 'line' ? `${metricColor}20` : `${metricColor}50`,
      borderWidth: 2,
      fill: getChartType(metric) === 'line' ? false : true,
      yAxisID: 'y',
      pointRadius: getChartType(metric) === 'line' ? 0 : 3,
      pointHoverRadius: getChartType(metric) === 'line' ? 4 : 6
    }];

    // Add moving averages if enabled
    movingAverages.forEach((ma, index) => {
      if (ma.enabled) {
        const maData = calculateMovingAverage(mainData, ma.period, ma.type);
        datasets.push({
          label: `${ma.type} ${ma.period}`,
          data: maData,
          borderColor: index === 0 ? '#ff6b6b' : '#4ecdc4',
          backgroundColor: 'transparent',
          borderWidth: 1,
          fill: false,
          yAxisID: 'y',
          pointRadius: 0,
          pointHoverRadius: 3
        });
      }
    });

    // Add BTC price overlay if enabled and not already showing BTC price
    if (showBtcPrice && metric.id !== 'btc-price') {
      let btcPrices = labels.map((_, i) => {
        const trend = Math.sin(i / 10) * 0.1;
        const noise = (Math.random() - 0.5) * 0.03;
        return Math.max(45000 * (1 + trend + noise), 1); // Ensure minimum value of 1
      });
      
      // Filter out zero/negative values for logarithmic scale
      if (btcPriceScale === 'logarithmic') {
        btcPrices = btcPrices.map((value: number) => Math.max(value, 1));
      }
      
      datasets.push({
        label: 'BTC Price (USD)',
        data: btcPrices,
        borderColor: '#9ca3af',
        backgroundColor: 'transparent',
        borderWidth: 1,
        fill: false,
        yAxisID: 'y1',
        pointRadius: 0,
        pointHoverRadius: 3,
        borderDash: [5, 5]
      });
    }

    return {
      labels,
      datasets
    };
  };

  // Chart options with dual y-axis support
  const getChartOptions = () => {
    const isPriceMetric = selectedMetric && selectedMetric.id === 'ohlcv-candlestick';
    const isVolumeMetric = selectedMetric && selectedMetric.id === 'btc-volume';
    const hasSecondaryAxis = (showBtcPrice && !isPriceMetric) || isVolumeMetric;
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 750,
        easing: 'easeOutQuart' as const
      },
      plugins: {
        legend: {
          position: 'top' as const,
          display: true,
          labels: {
            usePointStyle: true,
            padding: 20,
            font: {
              size: 12,
              weight: '500' as const
            },
            color: '#e5e7eb',
            generateLabels: (chart: any) => {
              const original = Chart.defaults.plugins.legend.labels.generateLabels;
              const labels = original(chart);
              
              // Style labels differently for main metric vs overlays
              labels.forEach((label: any, index: number) => {
                if (label.text.includes('BTC Price')) {
                  label.fillStyle = '#F7931A';
                  label.strokeStyle = '#F7931A';
                } else if (label.text.includes('SMA') || label.text.includes('EMA')) {
                  label.strokeStyle = label.fillStyle;
                  label.fillStyle = 'transparent';
                  label.lineDash = label.text.includes('EMA') ? [5, 5] : [];
                }
              });
              
              return labels;
            }
          }
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#f9fafb',
          bodyColor: '#e5e7eb',
          borderColor: '#374151',
          borderWidth: 1,
          cornerRadius: 12,
          displayColors: true,
          padding: 12,
          titleFont: {
            size: 14,
            weight: '600' as const
          },
          bodyFont: {
            size: 13,
            weight: '500' as const
          },
          callbacks: {
            title: (tooltipItems: any[]) => {
              if (tooltipItems.length > 0) {
                return tooltipItems[0].label;
              }
              return '';
            },
            label: (context: any) => {
              const value = context.parsed.y;
              const datasetLabel = context.dataset.label;
              
              if (datasetLabel.includes('BTC Price') || datasetLabel.includes('Bitcoin')) {
                return `${datasetLabel}: $${value.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2
                })}`;
              } else if (datasetLabel.includes('SMA') || datasetLabel.includes('EMA')) {
                const unit = selectedMetric?.unit === 'USD' ? '$' : (selectedMetric?.unit || '');
                const prefix = unit === '$' ? '$' : '';
                const suffix = unit !== '$' && unit ? ` ${unit}` : '';
                return `${datasetLabel}: ${prefix}${value.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: value < 1 ? 6 : 2
                })}${suffix}`;
              } else {
              const unit = selectedMetric?.unit || '';
                const isUSD = unit === 'USD' || unit.includes('$');
                const prefix = isUSD ? '$' : '';
                const suffix = !isUSD && unit ? ` ${unit}` : '';
                return `${datasetLabel}: ${prefix}${value.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: value < 1 ? 6 : 2
                })}${suffix}`;
              }
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(75, 85, 99, 0.3)',
            drawBorder: false,
            lineWidth: 0.5
          },
          ticks: {
            color: '#9ca3af',
            maxTicksLimit: 12,
            maxRotation: 0,
            font: {
              size: 11,
              weight: '400' as const
            }
          },
          border: {
            color: 'rgba(75, 85, 99, 0.5)',
            width: 1
          }
        },
        y: {
          type: selectedScale as 'linear' | 'logarithmic',
          position: 'left' as const,
          beginAtZero: getChartType(selectedMetric) === 'bar' && selectedScale === 'linear' && !selectedMetric?.unit?.includes('%'),
          min: selectedScale === 'logarithmic' ? 0.1 : undefined,
          grid: {
            color: 'rgba(75, 85, 99, 0.2)',
            drawBorder: false,
            lineWidth: 0.5
          },
          border: {
            color: hasSecondaryAxis ? '#3b82f6' : '#9ca3af',
            width: 2
          },
          ticks: {
            color: hasSecondaryAxis ? '#3b82f6' : '#9ca3af',
            font: {
              size: 11,
              weight: '500' as const
            },
            callback: function(value: any) {
              if (typeof value === 'number') {
                const unit = selectedMetric?.unit || '';
                const isUSD = unit === 'USD' || unit.includes('$');
                
                if (selectedScale === 'logarithmic') {
                  if (value >= 1000000000) {
                    return (isUSD ? '$' : '') + (value / 1000000000).toFixed(1) + 'B' + (!isUSD && unit ? ` ${unit}` : '');
                  } else if (value >= 1000000) {
                    return (isUSD ? '$' : '') + (value / 1000000).toFixed(1) + 'M' + (!isUSD && unit ? ` ${unit}` : '');
                  } else if (value >= 1000) {
                    return (isUSD ? '$' : '') + (value / 1000).toFixed(0) + 'K' + (!isUSD && unit ? ` ${unit}` : '');
                  }
                  return (isUSD ? '$' : '') + value.toFixed(value < 1 ? 3 : 0) + (!isUSD && unit ? ` ${unit}` : '');
                } else {
                  const formatted = value.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: value < 1 ? 3 : 0
                  });
                  return (isUSD ? '$' : '') + formatted + (!isUSD && unit ? (unit === '%' ? '%' : ` ${unit}`) : '');
                }
              }
              return value;
            }
          }
        },
        ...(hasSecondaryAxis && {
          y1: {
            type: btcPriceScale as 'linear' | 'logarithmic',
            position: 'right' as const,
            min: btcPriceScale === 'logarithmic' ? 1 : undefined,
            grid: {
              drawOnChartArea: false,
            },
            border: {
              color: '#F7931A',
              width: 2
            },
            ticks: {
              color: '#F7931A',
              font: {
                size: 11,
                weight: '500' as const
              },
              callback: function(value: any) {
                if (typeof value === 'number') {
                  if (btcPriceScale === 'logarithmic') {
                    if (value >= 1000000) {
                      return '$' + (value / 1000000).toFixed(1) + 'M';
                    } else if (value >= 1000) {
                      return '$' + (value / 1000).toFixed(0) + 'K';
                    }
                    return '$' + value.toFixed(0);
                  } else {
                    if (value >= 100000) {
                      return '$' + (value / 1000).toFixed(0) + 'K';
                    }
                    return '$' + value.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    });
                  }
                }
                return value;
              }
            }
          }
        }) || (isPriceMetric && {
          y1: {
            type: btcPriceScale as 'linear' | 'logarithmic',
            position: 'right' as const,
            min: btcPriceScale === 'logarithmic' ? 1 : undefined,
            grid: {
              drawOnChartArea: false,
            },
            border: {
              color: '#F7931A',
              width: 2
            },
            ticks: {
              color: '#F7931A',
              font: {
                size: 11,
                weight: '500' as const
              },
              callback: function(value: any) {
                if (typeof value === 'number') {
                  if (btcPriceScale === 'logarithmic') {
                    if (value >= 1000000) {
                      return '$' + (value / 1000000).toFixed(1) + 'M';
                    } else if (value >= 1000) {
                      return '$' + (value / 1000).toFixed(0) + 'K';
                    }
                    return '$' + value.toFixed(0);
                  } else {
                    if (value >= 100000) {
                      return '$' + (value / 1000).toFixed(0) + 'K';
                    }
                    return '$' + value.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    });
                  }
                }
                return value;
              }
            }
          }
        })
      },
      hover: {
        mode: 'index' as const,
        intersect: false,
        animationDuration: 300
      },
      interaction: {
        mode: 'index' as const,
        axis: 'x' as const,
        intersect: false
      },
      elements: {
        point: {
          backgroundColor: '#ffffff',
          borderWidth: 2,
          hoverBorderWidth: 3,
          hoverRadius: 6
        },
        line: {
          borderCapStyle: 'round' as const,
          borderJoinStyle: 'round' as const
        }
      }
    };
  };

  // Toggle moving average
  const toggleMovingAverage = (index: number) => {
    setMovingAverages(prev => 
      prev.map((ma, i) => 
        i === index ? { ...ma, enabled: !ma.enabled } : ma
      )
    );
    
    // Refresh chart if metric is selected
    if (selectedMetric) {
      selectMetric(selectedMetric);
    }
  };

  // Add new moving average
  const addMovingAverage = () => {
    setMovingAverages(prev => [
      ...prev,
      { period: 100, type: 'SMA', enabled: false }
    ]);
  };

  // Remove moving average
  const removeMovingAverage = (index: number) => {
    setMovingAverages(prev => prev.filter((_, i) => i !== index));
    
    // Refresh chart if metric is selected
    if (selectedMetric) {
      selectMetric(selectedMetric);
    }
  };

  // Update moving average period
  const updateMovingAveragePeriod = (index: number, period: number) => {
    setMovingAverages(prev => 
      prev.map((ma, i) => 
        i === index ? { ...ma, period } : ma
      )
    );
    
    // Refresh chart if metric is selected and MA is enabled
    if (selectedMetric && movingAverages[index]?.enabled) {
      selectMetric(selectedMetric);
    }
  };

  // Update moving average type
  const updateMovingAverageType = (index: number, type: 'SMA' | 'EMA') => {
    setMovingAverages(prev => 
      prev.map((ma, i) => 
        i === index ? { ...ma, type } : ma
      )
    );
    
    // Refresh chart if metric is selected and MA is enabled
    if (selectedMetric && movingAverages[index]?.enabled) {
      selectMetric(selectedMetric);
    }
  };

  // Handle custom period change
  const handleCustomPeriodChange = (value: number) => {
    setCustomPeriod(value);
    // Auto-refresh chart after a short delay to avoid too many API calls
    setTimeout(() => {
      if (selectedMetric && selectedTimeframe === 'custom') {
        selectMetric(selectedMetric);
      }
    }, 500);
  };

  // Initialize with default metric
  React.useEffect(() => {
    if (metricCategories[0]?.metrics[0]) {
      selectMetric(metricCategories[0].metrics[0]);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 lg:p-6">
      <div className="max-w-[1920px] mx-auto">
        {/* Professional Header */}
        <div className="mb-6 lg:mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold bg-gradient-to-r from-orange-400 via-orange-300 to-yellow-400 bg-clip-text text-transparent">
                Bitcoin Analytics Studio
              </h1>
              <p className="text-gray-400 text-sm lg:text-base mt-1">
                Professional on-chain and market data visualization • Real-time insights • Advanced charting
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-2 bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-700/30">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">Live Data</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-2 rounded-lg border border-gray-700">
                <Database size={16} className="text-orange-400" />
                <span className="text-gray-300 text-sm font-medium">Snowflake DB</span>
              </div>
            </div>
        </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Active Metrics</div>
              <div className="text-lg font-bold text-white">
                {metricCategories.reduce((total, cat) => total + cat.count, 0)}
              </div>
            </div>
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Categories</div>
              <div className="text-lg font-bold text-white">{metricCategories.length}</div>
            </div>
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Data Sources</div>
              <div className="text-lg font-bold text-white">8</div>
            </div>
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Timeframes</div>
              <div className="text-lg font-bold text-white">{TIMEFRAMES.length}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 lg:gap-6 h-[calc(100vh-260px)] lg:h-[calc(100vh-280px)]">
          {/* Left Sidebar - Metrics */}
          <div className="col-span-12 lg:col-span-3">
            <Card className="h-full overflow-hidden bg-gray-800/30 backdrop-blur-sm border border-gray-700/50">
              <div className="p-4 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/50 to-gray-700/50">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 size={20} className="text-orange-400" />
                  Market Indicators
                </h2>
                <p className="text-xs text-gray-400 mt-1">Select metrics to analyze</p>
              </div>
              <div className="overflow-y-auto h-[calc(100%-80px)] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                {metricCategories.map((category: MetricCategory) => (
                  <div key={category.id} className="border-b border-gray-700/30 last:border-b-0">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full p-3 flex items-center justify-between hover:bg-gray-700/40 transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-orange-400 group-hover:text-orange-300 transition-colors">
                        {category.icon}
                        </div>
                        <span className="text-white font-medium text-sm">{category.name}</span>
                        <span className="text-xs bg-gradient-to-r from-orange-500 to-orange-400 text-black px-2 py-1 rounded-full font-medium">
                          {category.count}
                        </span>
                      </div>
                      <div className="text-gray-400 group-hover:text-white transition-colors">
                      {category.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </button>
                    
                    {category.expanded && (
                      <div className="bg-gray-900/20 border-t border-gray-700/30">
                        {category.metrics.map((metric: Metric) => (
                          <button
                            key={metric.id}
                            onClick={() => selectMetric(metric)}
                            className={`w-full p-3 pl-12 text-left hover:bg-gray-700/30 transition-all duration-200 group ${
                              selectedMetric?.id === metric.id 
                                ? 'bg-gradient-to-r from-orange-500/20 to-orange-400/10 border-r-3 border-orange-400 shadow-lg' 
                                : ''
                            }`}
                          >
                            <div className={`text-sm font-medium ${
                              selectedMetric?.id === metric.id ? 'text-orange-300' : 'text-white group-hover:text-orange-200'
                            }`}>
                              {metric.name}
                            </div>
                            <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                              {metric.description}
                            </div>
                            {metric.unit && (
                              <div className="text-xs text-gray-500 mt-1">
                                Unit: {metric.unit}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Main Chart Area */}
          <div className="col-span-12 lg:col-span-9 flex flex-col">
            {/* Chart Header */}
            <Card className="mb-4 bg-gray-800/30 backdrop-blur-sm border border-gray-700/50">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {selectedMetric?.name || 'Select a Metric'}
                    </h2>
                    {selectedMetric && (
                      <p className="text-gray-400 text-sm mt-1">{selectedMetric.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Chart type is now automatically determined based on metric type */}

                    {/* Scale Controls */}
                    <div className="flex bg-[var(--bitcoin-gray)] rounded-lg p-2 gap-4">
                      {/* Left Axis (Metric) Scale */}
                      <div className="flex flex-col gap-2">
                        <div className="text-xs text-gray-400 font-medium text-center">
                          Left Axis
                        </div>
                        <div className="flex gap-1">
                          {SCALES.map((scale) => (
                            <button
                              key={scale.id}
                              onClick={() => setSelectedScale(scale.id)}
                              className={`px-3 py-1.5 rounded-md transition-all duration-200 text-xs font-medium ${
                                selectedScale === scale.id
                                  ? 'bg-blue-500 text-white shadow-md'
                                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
                              }`}
                            >
                              {scale.label}
                            </button>
                          ))}
                        </div>
                        <div className="text-xs text-blue-400 text-center truncate max-w-[80px]">
                          {selectedMetric?.name.split(' ').slice(0, 2).join(' ') || 'Metric'}
                        </div>
                      </div>
                      
                      {/* Right Axis (BTC Price) Scale - always show */}
                      <div className="flex flex-col gap-2 pl-4 border-l border-gray-600">
                        <div className="text-xs text-gray-400 font-medium text-center">
                          Right Axis
                        </div>
                        <div className="flex gap-1">
                            {SCALES.map((scale) => (
                              <button
                                key={scale.id}
                                onClick={() => setBtcPriceScale(scale.id)}
                              className={`px-3 py-1.5 rounded-md transition-all duration-200 text-xs font-medium ${
                                  btcPriceScale === scale.id
                                  ? 'bg-[var(--bitcoin-orange)] text-black shadow-md'
                                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                              >
                                {scale.label}
                              </button>
                            ))}
                          </div>
                                                                                                <div className="text-xs text-[var(--bitcoin-orange)] text-center">
                          {(selectedMetric && selectedMetric.id === 'ohlcv-candlestick') 
                            ? 'Price' 
                            : selectedMetric && selectedMetric.id === 'btc-volume'
                            ? 'Auto (Volume + BTC)'
                            : showBtcPrice ? 'BTC Price' : 'Disabled'}
                          </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button className="p-2 text-gray-400 hover:text-white transition-colors">
                        <Download size={20} />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-white transition-colors">
                        <Maximize2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Timeframe Selector */}
                <div className="flex gap-2 mt-4">
                  {TIMEFRAMES.map((timeframe) => (
                    <button
                      key={timeframe.id}
                      onClick={() => {
                        setSelectedTimeframe(timeframe.id);
                        if (selectedMetric) {
                          selectMetric(selectedMetric);
                        }
                      }}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${
                        selectedTimeframe === timeframe.id
                          ? 'bg-[var(--bitcoin-orange)] text-black font-medium'
                          : 'text-gray-400 hover:text-white hover:bg-[var(--bitcoin-gray)]'
                      }`}
                    >
                      {timeframe.label}
                    </button>
                  ))}
                  
                  {/* Custom Period Input */}
                  {selectedTimeframe === 'custom' && (
                    <div className="flex items-center gap-2 ml-4">
                      <input
                        type="number"
                        value={customPeriod}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 30;
                          handleCustomPeriodChange(value);
                        }}
                        onBlur={() => {
                          if (selectedMetric) {
                            selectMetric(selectedMetric);
                          }
                        }}
                        className="w-20 px-2 py-1 text-sm bg-[var(--bitcoin-gray)] border border-gray-600 rounded text-white"
                        min="1"
                        max="10000"
                        placeholder="Days"
                      />
                      <span className="text-sm text-gray-400">days</span>
                    </div>
                  )}
                </div>

                {/* Chart Options */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 pt-4 border-t border-[var(--border-color)]">
                  {/* BTC Price Overlay - Hide for candlestick */}
                  {selectedMetric?.id !== 'ohlcv-candlestick' && (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className={`flex items-center gap-3 text-sm ${
                          selectedMetric?.id === 'btc-volume' 
                            ? 'text-gray-500 cursor-not-allowed' 
                            : 'text-gray-300 cursor-pointer'
                        }`}>
                          <div className="relative">
                      <input
                        type="checkbox"
                        checked={selectedMetric?.id === 'btc-volume' || showBtcPrice}
                        disabled={selectedMetric?.id === 'btc-volume'}
                        onChange={(e) => {
                          if (selectedMetric?.id !== 'btc-volume') {
                          setShowBtcPrice(e.target.checked);
                          if (selectedMetric) {
                            selectMetric(selectedMetric);
                            }
                          }
                        }}
                              className="sr-only"
                            />
                            <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                              selectedMetric?.id === 'btc-volume' || showBtcPrice 
                                ? 'bg-[var(--bitcoin-orange)]' 
                                : 'bg-gray-600'
                            } ${selectedMetric?.id === 'btc-volume' ? 'opacity-60' : ''}`}>
                              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                                selectedMetric?.id === 'btc-volume' || showBtcPrice 
                                  ? 'translate-x-5' 
                                  : 'translate-x-0.5'
                              } translate-y-0.5`} />
                            </div>
                          </div>
                          <span className="font-medium">
                            {selectedMetric?.id === 'btc-volume' 
                              ? 'BTC Price Overlay (Auto)' 
                              : 'Show BTC Price Overlay'}
                          </span>
                    </label>
                      </div>
                    </div>
                  )}

                  {/* Moving Averages - Hide for candlestick */}
                  {selectedMetric?.id !== 'ohlcv-candlestick' && (
                    <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300 font-medium">Moving Averages</span>
                      {movingAverages.length < 4 && (
                        <button
                          onClick={addMovingAverage}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--bitcoin-orange)] text-black rounded-md hover:bg-orange-400 transition-colors"
                        >
                          <Plus size={12} />
                          Add MA
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                    {movingAverages.map((ma, index) => (
                        <div key={index} className="flex items-center gap-2 bg-[var(--bitcoin-gray)] rounded-lg p-2">
                          <input
                            type="checkbox"
                            checked={ma.enabled}
                            onChange={() => toggleMovingAverage(index)}
                            className="rounded border-gray-600 bg-gray-700 text-[var(--bitcoin-orange)] focus:ring-[var(--bitcoin-orange)] focus:ring-offset-0"
                          />
                          
                          <select
                            value={ma.type}
                            onChange={(e) => updateMovingAverageType(index, e.target.value as 'SMA' | 'EMA')}
                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-[var(--bitcoin-orange)] focus:border-[var(--bitcoin-orange)]"
                          >
                            <option value="SMA">SMA</option>
                            <option value="EMA">EMA</option>
                          </select>
                          
                          <input
                            type="number"
                            value={ma.period}
                            onChange={(e) => updateMovingAveragePeriod(index, parseInt(e.target.value) || 20)}
                            className="w-16 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white focus:ring-1 focus:ring-[var(--bitcoin-orange)] focus:border-[var(--bitcoin-orange)]"
                            min="1"
                            max="365"
                            placeholder="20"
                          />
                          
                          <span className="text-xs text-gray-400">periods</span>
                          
                          {movingAverages.length > 1 && (
                          <button
                            onClick={() => removeMovingAverage(index)}
                              className="ml-auto text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-900/20 transition-colors"
                              title="Remove MA"
                          >
                              <Minus size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  </div>
                  )}
                  
                </div>
              </div>
            </Card>

            {/* Chart Container */}
            <Card className="flex-1 bg-gray-800/30 backdrop-blur-sm border border-gray-700/50">
              <div className="h-full p-4">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <RefreshCw size={48} className="animate-spin text-[var(--bitcoin-orange)] mx-auto mb-4" />
                      <p className="text-white">Loading chart data...</p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-red-500 mb-4">⚠️</div>
                      <p className="text-white mb-2">Error loading data</p>
                      <p className="text-gray-400 text-sm">{error}</p>
                      <p className="text-gray-500 text-xs mt-2">Showing sample data for demonstration</p>
                    </div>
                  </div>
                ) : candlestickData ? (
                  <div className="h-full">
                    <AdvancedCandlestickChart
                      data={candlestickData}
                      chartType="candlestick"
                      showVolume={true}
                      height={500}
                      title={selectedMetric?.name || 'Bitcoin OHLCV Chart'}
                    />
                  </div>
                ) : chartData ? (
                  <div className="h-full">
                    <ChartComponent
                      type={getChartType(selectedMetric) as 'line' | 'bar'}
                      data={chartData}
                      options={getChartOptions()}
                      height={500}
                    />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <BarChart3 size={64} className="mx-auto mb-4 opacity-20" />
                      <p>Select a metric to view chart</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Indicator Explanation */}
            {selectedMetric && (
              <Card className="mt-4 bg-gray-800/30 backdrop-blur-sm border border-gray-700/50">
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-[var(--bitcoin-orange)] bg-opacity-20 rounded-lg flex items-center justify-center">
                        <Database size={24} className="text-[var(--bitcoin-orange)]" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">
                        About {selectedMetric.name}
                      </h3>
                      <p className="text-gray-300 mb-4 leading-relaxed">
                        {selectedMetric.explanation}
                      </p>
                      
                      <div className="bg-[var(--bitcoin-gray)] rounded-lg p-4 border border-gray-700">
                        <h4 className="text-sm font-semibold text-[var(--bitcoin-orange)] mb-2 flex items-center gap-2">
                          <span className="text-lg">📊</span>
                          Formula
                        </h4>
                        <code className="text-sm text-gray-300 font-mono bg-black bg-opacity-30 px-3 py-2 rounded border border-gray-600 block">
                          {selectedMetric.formula}
                        </code>
                      </div>

                      {/* Additional interpretation guidelines for key indicators */}
                      {selectedMetric.id === 'mvrv' && (
                        <div className="mt-4 bg-blue-900 bg-opacity-20 rounded-lg p-4 border border-blue-700">
                          <h4 className="text-sm font-semibold text-blue-400 mb-2">📈 Interpretation Guidelines</h4>
                          <ul className="text-sm text-gray-300 space-y-1">
                            <li>• <strong>MVRV &gt; 3.7:</strong> Historically indicates market tops (sell signal)</li>
                            <li>• <strong>MVRV 1-3.7:</strong> Normal market conditions</li>
                            <li>• <strong>MVRV &lt; 1:</strong> Market bottoms, potential buying opportunity</li>
                          </ul>
                        </div>
                      )}

                      {selectedMetric.id === 'nupl' && (
                        <div className="mt-4 bg-blue-900 bg-opacity-20 rounded-lg p-4 border border-blue-700">
                          <h4 className="text-sm font-semibold text-blue-400 mb-2">📈 Interpretation Guidelines</h4>
                          <ul className="text-sm text-gray-300 space-y-1">
                            <li>• <strong>NUPL &gt; 0.75:</strong> Euphoria/Greed - potential market top</li>
                            <li>• <strong>NUPL 0.5-0.75:</strong> Belief/Optimism phase</li>
                            <li>• <strong>NUPL 0.25-0.5:</strong> Hope/Anxiety phase</li>
                            <li>• <strong>NUPL &lt; 0.25:</strong> Fear/Capitulation - potential buying opportunity</li>
                          </ul>
                        </div>
                      )}

                      {selectedMetric.id === 'sopr' && (
                        <div className="mt-4 bg-blue-900 bg-opacity-20 rounded-lg p-4 border border-blue-700">
                          <h4 className="text-sm font-semibold text-blue-400 mb-2">📈 Interpretation Guidelines</h4>
                          <ul className="text-sm text-gray-300 space-y-1">
                            <li>• <strong>SOPR &gt; 1:</strong> More coins sold at profit than loss</li>
                            <li>• <strong>SOPR = 1:</strong> Break-even point</li>
                            <li>• <strong>SOPR &lt; 1:</strong> More coins sold at loss than profit</li>
                            <li>• <strong>Trend:</strong> Rising SOPR suggests profit-taking, falling SOPR suggests capitulation</li>
                          </ul>
                        </div>
                      )}

                      {(selectedMetric.id === 'exchange-inflow' || selectedMetric.id === 'exchange-outflow') && (
                        <div className="mt-4 bg-blue-900 bg-opacity-20 rounded-lg p-4 border border-blue-700">
                          <h4 className="text-sm font-semibold text-blue-400 mb-2">📈 Interpretation Guidelines</h4>
                          <ul className="text-sm text-gray-300 space-y-1">
                            <li>• <strong>High Inflows:</strong> Potential selling pressure, bearish signal</li>
                            <li>• <strong>High Outflows:</strong> Accumulation behavior, bullish signal</li>
                            <li>• <strong>Net Flow:</strong> Outflow - Inflow shows overall direction</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 