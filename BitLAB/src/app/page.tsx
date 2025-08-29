"use client";

import React from 'react';
import { Card, CardStat } from '@/components/ui/Card';
import { Chart, formatChartData } from '@/components/ui/Chart';
import { GaugeChart } from '@/components/ui/GaugeChart';
import { 
  Bitcoin, 
  BarChart4, 
  Network, 
  ArrowUpRight, 
  CircleDollarSign, 
  Scale,
  TrendingUp,
  Percent,
  Clock,
  Newspaper,
  Calendar,
  ExternalLink,
  RefreshCw,

} from 'lucide-react';
import Link from 'next/link';
import { 
  fetchDashboardMetrics, 
  getBitcoinActiveAddresses, 
  DashboardMetrics
} from '@/lib/api';
import type { BtcDataPoint } from '@/lib/utils/csv-parser';
import { FearGreedMeter } from '@/components/FearGreedMeter';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { useFearGreed } from '@/hooks/useFearGreed';
import { useBTCDaily } from '@/hooks/useBTCDaily';
import { useOHLCV } from '@/hooks/useOHLCV';
import { useFinancialMarket } from '@/hooks/useFinancialMarket';
import { useTradingSignals } from '@/hooks/useTradingSignals';
import { useRealizedPrice } from '@/hooks/useRealizedPrice';
import { useOnchainStrategy } from '@/hooks/useOnchainStrategy';
import { useBlockchainMetrics } from '@/hooks/useBlockchainMetrics';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TradingSignals } from '@/components/TradingSignals';
import { FearGreedHourlyAnalysis } from '@/components/FearGreedHourlyAnalysis';
import { MVRVIndicator } from '@/components/MVRVIndicator';
import { NUPLIndicator } from '@/components/NUPLIndicator';

import Image from 'next/image';

// Define Block interface
interface Block {
  BLOCK_NUMBER: number;
  BLOCK_TIMESTAMP: string;
  TX_COUNT: number;
  SIZE: number;
}

// Define NewsItem interface for CryptoCompare API
interface NewsItem {
  id: string;
  guid: string;
  published_on: number;
  imageurl: string;
  title: string;
  url: string;
  body: string;
  tags: string;
  lang: string;
  upvotes: string;
  downvotes: string;
  categories: string;
  source_info: {
    name: string;
    img: string;
    lang: string;
  };
  source: string;
}

// CryptoCompare API response interface
interface CryptoCompareNewsResponse {
  Type: number;
  Message: string;
  Promoted: any[];
  Data: NewsItem[];
}

export default function Home() {
  // Use the new hooks for real-time data
  const [selectedTimeframe, setSelectedTimeframe] = React.useState('1m');
  const { 
    price: btcPrice, 
    priceChange: btcPriceChange, 
    isLoading: priceLoading, 
    timeSinceUpdate,
    refreshPrice 
  } = useBitcoinPrice();
  const { currentValue: fngValue, yesterdayValue: fngYesterdayValue, lastWeekValue: fngLastWeekValue, currentClass: fngClass, isLoading: fngLoading } = useFearGreed();
  const { data: ohlcvData, isLoading: ohlcvLoading, refreshData: refreshOHLCV } = useOHLCV(30);
  const { data: btcDailyData, isLoading: btcDailyLoading, refreshData: refreshBTCDaily } = useBTCDaily(selectedTimeframe);
  const { data: financialMarketData, isLoading: financialMarketLoading } = useFinancialMarket(30);
  const { data: tradingSignalsData, isLoading: tradingSignalsLoading } = useTradingSignals();
  const { data: realizedPriceData, isLoading: realizedPriceLoading } = useRealizedPrice(30);
  const { data: onchainStrategyData, isLoading: onchainStrategyLoading } = useOnchainStrategy(30);
  
  // Use blockchain metrics hook for supply and difficulty data
  const { 
    bitcoinSupply, 
    miningDifficulty, 
    activeAddresses: blockchainActiveAddresses,
    isLoading: blockchainLoading,
    refreshMetrics: refreshBlockchainMetrics
  } = useBlockchainMetrics();
  
  const [metrics, setMetrics] = React.useState<{
    dashboardMetrics: DashboardMetrics | null;
    active_addresses: any | null;
  }>({
    dashboardMetrics: null,
    active_addresses: null
  });
  
  const [loading, setLoading] = React.useState(true);
  const [currentTime, setCurrentTime] = React.useState('');
  const [blockData, setBlockData] = React.useState<Block[]>([]);
  const [bitcoinNews, setBitcoinNews] = React.useState<NewsItem[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Function to delay execution (sleep)
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Function to fetch news data from CryptoCompare API
  const fetchNewsData = async () => {
    try {
      console.log('📰 Starting news fetch...');
      setBitcoinNews([]); // Clear existing news while loading
      
      // Add a random delay between 1000ms and 3000ms to prevent rate limiting
      const randomDelay = Math.floor(Math.random() * 2000) + 1000;
      await sleep(randomDelay);
      
      console.log(`🕒 Fetching Bitcoin news with ${randomDelay}ms delay...`);
      
      // Use CryptoCompare API for Bitcoin news
      const apiUrl = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC';
      
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          console.warn('⚠️ Rate limit exceeded for news API. Using fallback data.');
          setBitcoinNews(sampleNewsData.slice(0, 3));
          return;
        }
        throw new Error(`Failed to fetch news: ${response.status}`);
      }
      
      const newsResponse: CryptoCompareNewsResponse = await response.json();
      console.log('📰 News data received:', { total: newsResponse.Data.length, message: newsResponse.Message });
      
      // Filter for Bitcoin-related news items (already filtered by BTC category, but double-check)
      const bitcoinNewsItems = newsResponse.Data.filter((item: NewsItem) => 
        item.title.toLowerCase().includes('bitcoin') || 
        item.title.toLowerCase().includes('btc') ||
        item.body.toLowerCase().includes('bitcoin') ||
        item.body.toLowerCase().includes('btc') ||
        item.categories.toLowerCase().includes('btc')
      );
      
      console.log('🎯 Filtered Bitcoin news:', { count: bitcoinNewsItems.length });
      
      // Take the 3 most recent Bitcoin news items
      setBitcoinNews(bitcoinNewsItems.slice(0, 3));
      
    } catch (error) {
      console.error('❌ Error fetching news:', error);
      // If API fails, use sample data as fallback
      console.log('🔄 Using fallback news data');
      setBitcoinNews(sampleNewsData.slice(0, 3));
    }
  };

  // Load dashboard data
  const loadData = async () => {
    try {
      console.log('🔄 Loading dashboard data...');
      
      // Load metrics
      const dashboardData = await fetchDashboardMetrics();
      const activeAddresses = await getBitcoinActiveAddresses();
      
      console.log('📊 Dashboard data received:', { dashboardData, activeAddresses });
      
      setMetrics({
        dashboardMetrics: dashboardData,
        active_addresses: activeAddresses
      });
      
      // Fetch real block data from the API
      console.log('🔍 Fetching latest blocks...');
      const blockResponse = await fetch('/api/blockchain/latest-blocks');
      if (blockResponse.ok) {
        const data = await blockResponse.json();
        console.log('📦 Block data received:', { count: data.length, sample: data.slice(0, 2) });
        setBlockData(data);
      } else {
        console.error('❌ Failed to fetch blocks:', blockResponse.status, blockResponse.statusText);
        // Set empty array to stop loading state
        setBlockData([]);
      }
      
      // Fetch Bitcoin news from the CryptoCompare API
      console.log('📰 Fetching news...');
      await fetchNewsData();
    } catch (error) {
      console.error('❌ Failed to load data:', error);
      // Set empty states to stop loading
      setBlockData([]);
      setBitcoinNews([]);
    } finally {
      console.log('✅ Data loading completed');
      setLoading(false);
    }
  };

  // Data refresh functionality
  const refreshAllData = async () => {
    setIsRefreshing(true);
    try {
      console.log('🔄 Starting comprehensive data refresh...');
      
      // Refresh all hook-based data (these will refetch from Snowflake/APIs)
      await Promise.allSettled([
        refreshPrice(),
        refreshOHLCV(),
        refreshBTCDaily(),
        refreshBlockchainMetrics(),
        // Add other hook refresh functions as they become available
      ]);
      
      // Refresh manual data fetches
      await Promise.allSettled([
        loadData(),
        fetchNewsData()
      ]);
      
      console.log('✅ All data refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  React.useEffect(() => {
    // Initial data load on page load
    const initializeData = async () => {
      console.log('🚀 Initializing application data...');
      try {
        // Start with loading the basic data first
        await loadData();
        
        // Initial news fetch
        await fetchNewsData();
      } catch (error) {
        console.error('❌ Error during initialization:', error);
        // Ensure loading state is cleared even if there's an error
        setLoading(false);
        // Set fallback news data
        setBitcoinNews(sampleNewsData.slice(0, 3));
      }
    };
    
    initializeData();
    
    // Update the time
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);

  // Separate effect to check for news fallback
  React.useEffect(() => {
    if (!loading && bitcoinNews.length === 0) {
      console.log('📰 No news loaded after initialization, using fallback data');
      setBitcoinNews(sampleNewsData.slice(0, 3));
    }
  }, [loading, bitcoinNews.length]);

  // Format block size to MB
  const formatBlockSize = (sizeInBytes: number) => {
    return (sizeInBytes / (1024 * 1024)).toFixed(2);
  };

  // Prepare Bitcoin price chart data (using daily data from BTC_PRICE_USD)
  const priceChartData = React.useMemo(() => {
    console.log('🔍 Processing BTC daily data for chart:', {
      dataLength: btcDailyData?.length,
      isArray: Array.isArray(btcDailyData),
      firstFewItems: btcDailyData?.slice(0, 3)
    });
    
    if (!btcDailyData || !Array.isArray(btcDailyData) || btcDailyData.length === 0) {
      return formatChartData([], []); 
    }
    
    // Sort data chronologically by date
    const sortedData = [...btcDailyData].sort((a, b) => 
      new Date(a.DATE).getTime() - new Date(b.DATE).getTime()
    );
    
    console.log('📊 Chart data sample:', {
      totalPoints: sortedData.length,
      firstPoint: sortedData[0],
      lastPoint: sortedData[sortedData.length - 1],
      priceRange: {
        min: Math.min(...sortedData.map(p => p.BTC_PRICE_USD)),
        max: Math.max(...sortedData.map(p => p.BTC_PRICE_USD))
      }
    });
    
    return formatChartData(
      sortedData.map(point => {
        const date = new Date(point.DATE);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear();
        
        // Format date based on timeframe
        if (selectedTimeframe === '10y') {
          return `${month}/${year}`;
        } else if (selectedTimeframe === '3y') {
          return `${month}/${day}/${year.toString().slice(-2)}`;
        } else {
          return `${month}/${day}`;
        }
      }),
      [
        {
          label: `Bitcoin Price (USD) - ${selectedTimeframe.toUpperCase()}`,
          data: sortedData.map(point => point.BTC_PRICE_USD),
          borderColor: '#F7931A',
          backgroundColor: 'rgba(247, 147, 26, 0.2)',
        },
      ]
    );
  }, [btcDailyData, selectedTimeframe]);

  // Format price for display
  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(parseFloat(price));
  };

  // Format percentage for display
  const formatPercent = (value: string) => {
    return `${parseFloat(value).toFixed(2)}%`;
  };

  // Format hashrate for display
  const formatHashrate = (value: string) => {
    try {
      const hashrate = parseFloat(value);
      if (isNaN(hashrate)) {
        console.warn('⚠️ Invalid hashrate value:', value);
        return 'N/A';
      }
      return `${(hashrate / 1e18).toFixed(2)} EH/s`; // Convert to EH/s
    } catch (error) {
      console.error('❌ Error formatting hashrate:', error, value);
      return 'N/A';
    }
  };

  // Format difficulty for display
  const formatDifficulty = (value: string) => {
    try {
      const difficulty = parseFloat(value);
      if (isNaN(difficulty)) {
        console.warn('⚠️ Invalid difficulty value:', value);
        return 'N/A';
      }
      if (difficulty > 1e12) {
        return `${(difficulty / 1e12).toFixed(2)}T`;
      }
      return difficulty.toString();
    } catch (error) {
      console.error('❌ Error formatting difficulty:', error, value);
      return 'N/A';
    }
  };

  // Prepare Trade Volume chart data
  const tradeVolumeChartData = React.useMemo(() => {
    if (!ohlcvData || !Array.isArray(ohlcvData) || ohlcvData.length === 0) {
      return formatChartData([], []); 
    }
    
    return formatChartData(
      ohlcvData.map(point => {
        const date = new Date(point.DATE);
        return `${date.getMonth()+1}/${date.getDate()}`;
      }),
      [
        {
          label: 'Trade Volume',
          data: ohlcvData.map(point => point.VOLUME), // Use 'VOLUME' column
          borderColor: '#36A2EB', // Different color
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
        },
      ]
    );
  }, [ohlcvData]);

  // Prepare financial market charts data
  const nasdaqChartData = React.useMemo(() => {
    if (!financialMarketData || !Array.isArray(financialMarketData) || financialMarketData.length === 0) {
      return formatChartData([], []); 
    }
    
    return formatChartData(
      financialMarketData.map(point => {
        const date = new Date(point.date);
        return `${date.getMonth()+1}/${date.getDate()}`;
      }),
      [
        {
          label: 'NASDAQ Index',
          data: financialMarketData.map(point => point.nasdaq),
          borderColor: '#39FF14', // Purple color for NASDAQ
          backgroundColor: 'rgba(70, 193, 97, 0.2)',
        },
      ]
    );
  }, [financialMarketData]);

  const goldChartData = React.useMemo(() => {
    if (!financialMarketData || !Array.isArray(financialMarketData) || financialMarketData.length === 0) {
      return formatChartData([], []); 
    }
    
    return formatChartData(
      financialMarketData.map(point => {
        const date = new Date(point.date);
        return `${date.getMonth()+1}/${date.getDate()}`;
      }),
      [
        {
          label: 'Gold Price',
          data: financialMarketData.map(point => point.gold),
          borderColor: '#FFD700', // Gold color
          backgroundColor: 'rgba(255, 215, 0, 0.2)',
        },
      ]
    );
  }, [financialMarketData]);

  const vixChartData = React.useMemo(() => {
    if (!financialMarketData || !Array.isArray(financialMarketData) || financialMarketData.length === 0) {
      return formatChartData([], []); 
    }
    
    return formatChartData(
      financialMarketData.map(point => {
        const date = new Date(point.date);
        return `${date.getMonth()+1}/${date.getDate()}`;
      }),
      [
        {
          label: 'VIX Index',
          data: financialMarketData.map(point => point.vix),
          borderColor: '#FF6B6B', // Red color for VIX
          backgroundColor: 'rgba(255, 107, 107, 0.2)',
        },
      ]
    );
  }, [financialMarketData]);

  const dxyChartData = React.useMemo(() => {
    if (!financialMarketData || !Array.isArray(financialMarketData) || financialMarketData.length === 0) {
      return formatChartData([], []); 
    }
    
    return formatChartData(
      financialMarketData.map(point => {
        const date = new Date(point.date);
        return `${date.getMonth()+1}/${date.getDate()}`;
      }),
      [
        {
          label: 'DXY Index',
          data: financialMarketData.map(point => point.dxy),
          borderColor: '#4ECDC4', // Teal color for DXY
          backgroundColor: 'rgba(78, 205, 196, 0.2)',
        },
      ]
    );
  }, [financialMarketData]);

  const realizedPriceChartData = React.useMemo(() => {
    if (!realizedPriceData || !Array.isArray(realizedPriceData) || realizedPriceData.length === 0) {
      return formatChartData([], []); 
    }
    
    // Sort data chronologically (oldest first) since API returns DESC order
    const sortedData = [...realizedPriceData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return formatChartData(
      sortedData.map(point => {
        const date = new Date(point.date);
        return `${date.getMonth()+1}/${date.getDate()}`;
      }),
      [
        {
          label: 'Bitcoin Realized Price (USD)',
          data: sortedData.map(point => point.realizedPrice),
          borderColor: '#9333EA', // Purple color for realized price
          backgroundColor: 'rgba(147, 51, 234, 0.2)',
        },
      ]
    );
  }, [realizedPriceData]);

  // Format date for news items
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Debug Fear & Greed values
  React.useEffect(() => {
    console.log('🎯 Main Page - Fear & Greed values:', {
      fngValue,
      fngYesterdayValue,
      fngLastWeekValue,
      fngClass,
      fngLoading
    });
  }, [fngValue, fngYesterdayValue, fngLastWeekValue, fngClass, fngLoading]);

  // Debug metrics values
  React.useEffect(() => {
    console.log('📊 Main Page - Dashboard metrics:', {
      metrics,
      loading,
      dashboardMetrics: metrics.dashboardMetrics,
      activeAddresses: metrics.active_addresses
    });
  }, [metrics, loading]);

  return (
    <ErrorBoundary>
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-fade-in">
        <div className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
            <h1 className="text-4xl font-extrabold text-white gradient-text animate-slide-up">
              Decoding Bitcoin. Delivering Results.
            </h1>
            <div className="flex items-center gap-3 mt-3 sm:mt-0">
              {/* Refresh Button */}
              <button
                onClick={refreshAllData}
                disabled={isRefreshing}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${isRefreshing 
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                    : 'bg-bitcoin-orange hover:bg-orange-600 text-black hover:shadow-lg'
                  }
                `}
                title="Refresh all data from Snowflake and APIs"
              >
                <RefreshCw 
                  className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                />
                {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>
          </div>
          <p className="text-lg text-gray-300 animate-slide-up" style={{ animationDelay: '100ms' }}>
          BitLAB offers comprehensive Bitcoin market analysis, trading signals, and investment insights powered by advanced data science.
          </p>
        </div>

        {/* Key Metrics with staggered animation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          <CardStat
            title="Current Price"
            value={btcPrice ? formatPrice(btcPrice) : "Loading..."}
            change={btcPriceChange.value}
            isPositive={btcPriceChange.isPositive}
            icon={<Bitcoin className="h-5 w-5" />}
            isLoading={priceLoading}
            autoRefresh={true}
            lastUpdate={timeSinceUpdate}
            onRefresh={refreshPrice}
            delay={0} // First item
          />
          <CardStat
            title="Active Addresses"
            value={blockchainActiveAddresses ? `${(blockchainActiveAddresses / 1000000).toFixed(2)}M` : "Loading..."}
            change="+0.8%"
            isPositive={true}
            icon={<Network className="h-5 w-5" />}
            isLoading={blockchainLoading}
            delay={100} // Second item
          />
          <CardStat
            title="Bitcoin Supply"
            value={bitcoinSupply ? `${(bitcoinSupply / 1000000).toFixed(2)}M BTC` : "Loading..."}
            change="+0.01%"
            isPositive={true}
            icon={<Bitcoin className="h-5 w-5" />}
            isLoading={blockchainLoading}
            delay={200} // Third item
          />
          <CardStat
            title="Difficulty"
            value={miningDifficulty ? formatDifficulty(miningDifficulty.toString()) : "Loading..."}
            change="+3.1%"
            isPositive={true}
            icon={<Scale className="h-5 w-5" />}
            isLoading={blockchainLoading}
            delay={300} // Fourth item
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mb-12">
          {/* Main Chart Area (takes 5 columns) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Bitcoin Price Chart - Large */}
            <div className="animate-slide-up-delay" style={{ '--delay': '400ms' } as React.CSSProperties}>
              <Card className="h-full glow-border" isHoverable>
                <div className="p-4 border-b border-[var(--border-color)]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                      Bitcoin Price (USD) - {selectedTimeframe.toUpperCase()}
                    </h3>
                    <div className="flex gap-2">
                      {['1m', '1y', '3y', '10y'].map((timeframe) => (
                        <button
                          key={timeframe}
                          onClick={() => setSelectedTimeframe(timeframe)}
                          className={`px-3 py-1 rounded-md text-sm transition-colors ${
                            selectedTimeframe === timeframe
                              ? 'bg-[var(--bitcoin-orange)] text-black font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-[var(--bitcoin-gray)]'
                          }`}
                        >
                          {timeframe.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                  <Chart
                    type="line"
                    data={priceChartData}
                    height={350}
                  />
                </Card>
            </div>
            
            {/* Realized Price Chart - Large */}
            <div className="animate-slide-up-delay" style={{ '--delay': '950ms' } as React.CSSProperties}>
              <Card className="h-full glow-border" isHoverable>
                <Chart
                  title={`Bitcoin Realized Price`}
                  type="line"
                  data={realizedPriceChartData}
                  height={350}
                />
              </Card>
            </div>
            
            {/* Trade Volume and NASDAQ Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="animate-slide-up-delay" style={{ '--delay': '500ms' } as React.CSSProperties}>
                <Card className="h-full glow-border" isHoverable>
                  <Chart
                    title={`Trade Volume`}
                    type="bar"
                    data={tradeVolumeChartData}
                    height={250}
                  />
                </Card>
              </div>
              <div className="animate-slide-up-delay" style={{ '--delay': '600ms' } as React.CSSProperties}>
                <Card className="h-full glow-border" isHoverable>
                  <Chart 
                    title={`NASDAQ Index`}
                    type="line"
                    data={nasdaqChartData}
                    height={250}
                  />
                </Card>
              </div>
            </div>
            
            {/* Gold and VIX Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="animate-slide-up-delay" style={{ '--delay': '700ms' } as React.CSSProperties}>
                <Card className="h-full glow-border" isHoverable>
                  <Chart
                    title={`Gold Price`}
                    type="line"
                    data={goldChartData}
                    height={250}
                  />
                </Card>
              </div>
              <div className="animate-slide-up-delay" style={{ '--delay': '800ms' } as React.CSSProperties}>
                <Card className="h-full glow-border" isHoverable>
                  <Chart 
                    title={`VIX Index`}
                    type="line"
                    data={vixChartData}
                    height={250}
                  />
                </Card>
              </div>
            </div>
            
            {/* DXY Chart - Large */}
            <div className="animate-slide-up-delay" style={{ '--delay': '900ms' } as React.CSSProperties}>
              <Card className="h-full glow-border" isHoverable>
                <Chart
                  title={`DXY Index (US Dollar Index)`}
                  type="line"
                  data={dxyChartData}
                  height={350}
                />
              </Card>
            </div>
            
            
            {/* MVRV and NUPL Indicators - Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up-delay" style={{ '--delay': '1000ms' } as React.CSSProperties}>
              <MVRVIndicator />
              <NUPLIndicator />
            </div>
          </div>

          {/* Fear & Greed Meter, Trading Signals, and Hourly Analysis (takes 2 columns) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="animate-slide-up-delay" style={{ '--delay': '1050ms' } as React.CSSProperties}>
              <FearGreedMeter 
                value={fngValue || 50} 
                yesterdayValue={fngYesterdayValue || undefined} 
                lastWeekValue={fngLastWeekValue || undefined} 
              />
            </div>
            <div className="animate-slide-up-delay" style={{ '--delay': '1100ms' } as React.CSSProperties}>
              <TradingSignals 
                data={tradingSignalsData}
                isLoading={tradingSignalsLoading}
              />
            </div>
            <div className="animate-slide-up-delay" style={{ '--delay': '1150ms' } as React.CSSProperties}>
              <FearGreedHourlyAnalysis />
            </div>
          </div>
        </div>

        {/* Quick Access & Recent Blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Quick Access (takes 1 column) */}
          <div className="lg:col-span-1 animate-slide-up-delay" style={{ '--delay': '1200ms' } as React.CSSProperties}>
            <h2 className="text-xl font-semibold text-white mb-5 gradient-text">Quick Access</h2>
            <div className="flex flex-col gap-4">
              <Link href="/block-explorer" className="block">
                <Card className="card-hover-effect glass-panel">
                  <div className="flex items-center p-2">
                    <div className="p-2 rounded-lg bg-blue-900 mr-3">
                      <BarChart4 className="h-5 w-5 text-blue-300" />
                    </div>
                    <h3 className="font-medium text-white flex-grow">Block Explorer</h3>
                    <ArrowUpRight className="h-4 w-4 text-gray-400" />
                  </div>
                </Card>
              </Link>
               <Link href="/analytics" className="block">
                 <Card className="card-hover-effect glass-panel">
                   <div className="flex items-center p-2">
                     <div className="p-2 rounded-lg bg-purple-900 mr-3">
                       <TrendingUp className="h-5 w-5 text-purple-300" />
                     </div>
                     <h3 className="font-medium text-white flex-grow">Charts</h3>
                     <ArrowUpRight className="h-4 w-4 text-gray-400" />
                   </div>
                 </Card>
               </Link>
              <Link href="/trading" className="block">
                 <Card className="card-hover-effect glass-panel">
                   <div className="flex items-center p-2">
                     <div className="p-2 rounded-lg bg-orange-900 mr-3">
                       <Bitcoin className="h-5 w-5 text-orange-300" />
                     </div>
                     <h3 className="font-medium text-white flex-grow">Advanced Trading</h3>
                     <ArrowUpRight className="h-4 w-4 text-gray-400" />
                   </div>
                 </Card>
              </Link>
              <Link href="/technical-analysis" className="block">
                 <Card className="card-hover-effect glass-panel">
                   <div className="flex items-center p-2">
                     <div className="p-2 rounded-lg bg-green-900 mr-3">
                       <TrendingUp className="h-5 w-5 text-green-300" />
                     </div>
                     <h3 className="font-medium text-white flex-grow">Technical Analysis</h3>
                     <ArrowUpRight className="h-4 w-4 text-gray-400" />
                   </div>
                 </Card>
              </Link>
            </div>
          </div>

          {/* Recent Blocks (takes 2 columns) */}
          <div className="lg:col-span-2 animate-slide-up-delay" style={{ '--delay': '1250ms' } as React.CSSProperties}>
            <h2 className="text-xl font-semibold text-white mb-5 gradient-text">Recent Blocks</h2>
            <Card className="glass-panel glow-border">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead >
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Height</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">TXs</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Size (MB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {blockData.length > 0 ? (
                      blockData.slice(0, 5).map((block, i) => ( // Limit to 5 blocks
                        <tr key={i} className="hover:bg-[var(--bitcoin-gray)] transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[var(--bitcoin-orange)]">
                            <Link href={`/block-explorer?type=block&query=${block.BLOCK_NUMBER}`} className="hover:underline">
                              {block.BLOCK_NUMBER}
                            </Link>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {new Date(block.BLOCK_TIMESTAMP).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {block.TX_COUNT}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {formatBlockSize(block.SIZE)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-400">
                          <div className="flex justify-center items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[var(--bitcoin-orange)]"></div>
                            <span>Loading latest blocks...</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {blockData.length > 0 && (
                <div className="pt-3 pb-1 px-4 text-center">
                  <Link href="/block-explorer" className="text-sm text-[var(--bitcoin-orange)] hover:text-orange-400 font-medium transition-colors">
                    View All Blocks
                  </Link>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* News Section */}
        <div className="mb-12 animate-slide-up-delay" style={{ '--delay': '1300ms' } as React.CSSProperties}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white gradient-text flex items-center">
              <Newspaper className="mr-2 h-5 w-5 text-bitcoin-orange" />
              Latest Bitcoin News
            </h2>
            <Link href="/news" className="text-bitcoin-orange hover:underline flex items-center">
              View All News <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {bitcoinNews.length > 0 ? (
              bitcoinNews.map((item) => (
                <Card key={item.id} className="overflow-hidden hover:ring-1 hover:ring-bitcoin-orange transition duration-300" isHoverable>
                  <div className="h-40 relative bg-bitcoin-gray">
                    <Image 
                      src={item.imageurl || 'https://cdn.sanity.io/images/s3y3vcno/production/e7982f2cd16aaa896fdd1b231cf766d18f1f1cc2-1440x1080.jpg'} 
                      alt={item.title}
                      fill
                      style={{ objectFit: 'cover' }}
                      className="rounded-t-lg"
                      onError={(e) => {
                        // On error, replace with a fallback image URL from the same domain
                        const target = e.target as HTMLImageElement;
                        target.onerror = null; // Prevent infinite loop
                        target.src = 'https://cdn.sanity.io/images/s3y3vcno/production/e7982f2cd16aaa896fdd1b231cf766d18f1f1cc2-1440x1080.jpg';
                      }}
                      unoptimized={true} // Skip Next.js image optimization for some problematic URLs
                    />
                    <div className="absolute top-2 left-2 bg-bitcoin-orange text-black text-xs font-bold px-2 py-1 rounded">
                      {item.source_info.name}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center text-xs text-gray-400 mb-2">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>{formatDate(item.published_on)}</span>
                    </div>
                    <h3 className="font-bold mb-2 line-clamp-2 hover:text-bitcoin-orange transition-colors">{item.title}</h3>
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{item.body.substring(0, 150)}...</p>
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-bitcoin-orange text-sm hover:underline"
                    >
                      Read Article <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                </Card>
              ))
            ) : (
              // Loading state
              Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="h-40 bg-bitcoin-gray animate-pulse rounded-t-lg"></div>
                  <div className="p-4">
                    <div className="h-4 bg-bitcoin-gray animate-pulse rounded mb-2 w-1/3"></div>
                    <div className="h-5 bg-bitcoin-gray animate-pulse rounded mb-2"></div>
                    <div className="h-5 bg-bitcoin-gray animate-pulse rounded mb-2"></div>
                    <div className="h-4 bg-bitcoin-gray animate-pulse rounded mb-3 w-2/3"></div>
                    <div className="h-4 bg-bitcoin-gray animate-pulse rounded w-1/4"></div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
        


      </div>
    </ErrorBoundary>
  );
}

// Sample news data to simulate API response (only used as fallback if API fails)
const sampleNewsData: NewsItem[] = [
  {
    id: "7472474",
    guid: "https://bitcoinworld.co.in/?p=184582",
    published_on: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    imageurl: "https://cdn.sanity.io/images/s3y3vcno/production/e7982f2cd16aaa896fdd1b231cf766d18f1f1cc2-1440x1080.jpg",
    title: "Bitcoin Mining Profitability Stabilizes as Network Hash Rate Reaches New Highs",
    url: "https://www.coindesk.com/business/2025/07/30/bitcoin-mining-profitability-stabilizes",
    body: "Bitcoin mining profitability shows signs of stabilization as the network hash rate continues to climb, suggesting strong miner confidence despite market volatility. The stabilization comes as miners adapt to recent market conditions and optimize their operations for maximum efficiency.",
    tags: "Crypto News|Bitcoin|Mining|Hash Rate",
    lang: "EN",
    upvotes: "0",
    downvotes: "0",
    categories: "BTC|MINING|MARKET",
    source_info: {
      name: "CoinDesk",
      img: "https://images.cryptocompare.com/news/default/coindesk.png",
      lang: "EN"
    },
    source: "coindesk"
  },
  {
    id: "7472475",
    guid: "https://cointelegraph.com/news/institutional-bitcoin",
    published_on: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    imageurl: "https://static2.finnhub.io/file/publicdatany/hmpimage/cointelegraph.webp",
    title: "Institutional Bitcoin Adoption Continues to Grow as Major Corporations Add BTC to Balance Sheets",
    url: "https://cointelegraph.com/news/institutional-bitcoin-adoption-grows",
    body: "Several Fortune 500 companies have announced significant Bitcoin allocations, signaling growing institutional acceptance of cryptocurrency as a treasury asset. This trend represents a fundamental shift in how traditional corporations view digital assets.",
    tags: "Crypto News|Bitcoin|Institutional|Corporate",
    lang: "EN",
    upvotes: "0",
    downvotes: "0",
    categories: "BTC|INSTITUTIONAL|CORPORATE",
    source_info: {
      name: "Cointelegraph",
      img: "https://images.cryptocompare.com/news/default/cointelegraph.png",
      lang: "EN"
    },
    source: "cointelegraph"
  },
  {
    id: "7472476",
    guid: "https://bitcoinmagazine.com/technical-analysis",
    published_on: Math.floor(Date.now() / 1000) - 10800, // 3 hours ago
    imageurl: "https://cdn.sanity.io/images/s3y3vcno/production/d11d05d47c057f441be1f4cb1f5284bf3ccb87c9-1920x1080.jpg",
    title: "Bitcoin Network Processes Record Number of Transactions as Layer 2 Solutions Gain Traction",
    url: "https://bitcoinmagazine.com/technical/bitcoin-network-record-transactions",
    body: "The Bitcoin network has processed a record number of transactions in the past 24 hours, driven by increased adoption of Lightning Network and other Layer 2 scaling solutions. This milestone demonstrates the growing utility and scalability improvements of the Bitcoin ecosystem.",
    tags: "Crypto News|Bitcoin|Layer 2|Lightning Network",
    lang: "EN",
    upvotes: "0",
    downvotes: "0",
    categories: "BTC|LAYER2|SCALING",
    source_info: {
      name: "Bitcoin Magazine",
      img: "https://images.cryptocompare.com/news/default/bitcoinmagazine.png",
      lang: "EN"
    },
    source: "bitcoinmagazine"
  }
]; 