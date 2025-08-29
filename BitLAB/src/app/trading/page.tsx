'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import AdvancedCandlestickChart from '@/components/ui/AdvancedCandlestickChart';
import { useBTCHourly, BTCHourlyData } from '@/hooks/useBTCHourly';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Link from 'next/link';
import { 
  ArrowLeft, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Volume2,
  Clock,
  Calendar,
  BarChart3,
  LineChart,
  CandlestickChart as CandlestickIcon,
  Settings,
  Maximize2,
  Download
} from 'lucide-react';

interface TradingPageProps {}

export default function TradingPage({}: TradingPageProps) {
  const [timeRange, setTimeRange] = React.useState<number>(168); // Default: 7 days (168 hours)
  const [chartType, setChartType] = React.useState<'candlestick' | 'line' | 'area'>('candlestick');
  const [showVolume, setShowVolume] = React.useState(true);
  const [selectedCandle, setSelectedCandle] = React.useState<BTCHourlyData | null>(null);
  
  const { data: btcData, totalRecords, isLoading, error, forceRefresh } = useBTCHourly(timeRange);

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!btcData || btcData.length === 0) return null;
    
    const prices = btcData.map(d => d.close);
    const volumes = btcData.map(d => d.volume);
    
    const currentPrice = prices[0];
    const highPrice = Math.max(...prices);
    const lowPrice = Math.min(...prices);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    
    // Calculate 24h change
    const price24hAgo = btcData.length >= 24 ? btcData[23].close : prices[prices.length - 1];
    const change24h = ((currentPrice - price24hAgo) / price24hAgo) * 100;
    
    return {
      currentPrice,
      highPrice,
      lowPrice,
      avgVolume,
      change24h,
      isPositive: change24h >= 0
    };
  }, [btcData]);

  // Time range options
  const timeRanges = [
    { label: '24H', hours: 24 },
    { label: '3D', hours: 72 },
    { label: '7D', hours: 168 },
    { label: '30D', hours: 720 },
    { label: '90D', hours: 2160 },
    { label: 'ALL', hours: 8760 } // 1 year
  ];

  // Format price for display
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  // Format volume for display
  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
    return volume.toFixed(0);
  };

  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle candle click
  const handleCandleClick = (candle: BTCHourlyData) => {
    setSelectedCandle(candle);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Error Loading Trading Data</h1>
            <p className="text-gray-400 mb-4">{error.message}</p>
            <button 
              onClick={forceRefresh}
              className="bg-bitcoin-orange text-black px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[var(--background)] text-white">
        {/* Header */}
        <div className="border-b border-[var(--border-color)] bg-[var(--card-background)]">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href="/" className="flex items-center text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Dashboard
                </Link>
                <div className="h-6 w-px bg-[var(--border-color)]"></div>
                <h1 className="text-2xl font-bold gradient-text">Advanced Bitcoin Trading View</h1>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={forceRefresh}
                  disabled={isLoading}
                  className="flex items-center px-3 py-2 bg-[var(--bitcoin-gray)] rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                
                {totalRecords && (
                  <div className="text-sm text-gray-400">
                    <span>Records: {totalRecords.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-4">
          {/* Price Statistics */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <Card className="p-4">
                <div className="text-sm text-gray-400 mb-1">Current Price</div>
                <div className="text-xl font-bold text-white">{formatPrice(stats.currentPrice)}</div>
              </Card>
              
              <Card className="p-4">
                <div className="text-sm text-gray-400 mb-1">24h Change</div>
                <div className={`text-xl font-bold flex items-center ${stats.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                  {stats.change24h.toFixed(2)}%
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="text-sm text-gray-400 mb-1">24h High</div>
                <div className="text-xl font-bold text-white">{formatPrice(stats.highPrice)}</div>
              </Card>
              
              <Card className="p-4">
                <div className="text-sm text-gray-400 mb-1">24h Low</div>
                <div className="text-xl font-bold text-white">{formatPrice(stats.lowPrice)}</div>
              </Card>
              
              <Card className="p-4">
                <div className="text-sm text-gray-400 mb-1">Avg Volume</div>
                <div className="text-xl font-bold text-white flex items-center">
                  <Volume2 className="h-4 w-4 mr-1" />
                  {formatVolume(stats.avgVolume)}
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="text-sm text-gray-400 mb-1">Data Points</div>
                <div className="text-xl font-bold text-white">{btcData.length}</div>
              </Card>
            </div>
          )}

          {/* Chart Controls */}
          <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
            {/* Time Range Selector */}
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-400 mr-2">Time Range:</span>
              <div className="flex space-x-1">
                {timeRanges.map((range) => (
                  <button
                    key={range.label}
                    onClick={() => setTimeRange(range.hours)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      timeRange === range.hours
                        ? 'bg-bitcoin-orange text-black font-bold'
                        : 'bg-[var(--bitcoin-gray)] text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Type Selector */}
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-400 mr-2">Chart Type:</span>
              <div className="flex space-x-1">
                <button
                  onClick={() => setChartType('candlestick')}
                  className={`px-3 py-1 rounded text-sm transition-colors flex items-center ${
                    chartType === 'candlestick'
                      ? 'bg-bitcoin-orange text-black font-bold'
                      : 'bg-[var(--bitcoin-gray)] text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <CandlestickIcon className="h-3 w-3 mr-1" />
                  Candlestick
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={`px-3 py-1 rounded text-sm transition-colors flex items-center ${
                    chartType === 'line'
                      ? 'bg-bitcoin-orange text-black font-bold'
                      : 'bg-[var(--bitcoin-gray)] text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <LineChart className="h-3 w-3 mr-1" />
                  Line
                </button>
                <button
                  onClick={() => setChartType('area')}
                  className={`px-3 py-1 rounded text-sm transition-colors flex items-center ${
                    chartType === 'area'
                      ? 'bg-bitcoin-orange text-black font-bold'
                      : 'bg-[var(--bitcoin-gray)] text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Area
                </button>
              </div>
            </div>

            {/* Volume Toggle */}
            <div className="flex items-center space-x-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showVolume}
                  onChange={(e) => setShowVolume(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border-2 mr-2 flex items-center justify-center ${
                  showVolume ? 'bg-bitcoin-orange border-bitcoin-orange' : 'border-gray-400'
                }`}>
                  {showVolume && <div className="w-2 h-2 bg-black rounded-sm"></div>}
                </div>
                <Volume2 className="h-4 w-4 mr-1 text-gray-400" />
                <span className="text-sm text-gray-300">Show Volume</span>
              </label>
            </div>
          </div>

          {/* Main Chart Area */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Chart */}
            <div className="lg:col-span-3">
              <Card className="p-6">
                {isLoading ? (
                  <div className="flex items-center justify-center h-[600px]">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin text-bitcoin-orange mx-auto mb-4" />
                      <p className="text-gray-400">Loading trading data...</p>
                    </div>
                  </div>
                ) : btcData.length === 0 ? (
                  <div className="flex items-center justify-center h-[600px]">
                    <div className="text-center">
                      <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">No data available for the selected time range</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold gradient-text">
                        Advanced Bitcoin {chartType === 'candlestick' ? 'Candlestick' : chartType === 'line' ? 'Price' : 'Area'} Chart
                      </h3>
                      <div className="text-sm text-gray-400">
                        {timeRanges.find(r => r.hours === timeRange)?.label} • {btcData.length} candles
                      </div>
                    </div>
                    
                    <AdvancedCandlestickChart
                      data={btcData}
                      chartType={chartType}
                      showVolume={showVolume}
                      height={600}
                      onCandleClick={handleCandleClick}
                    />
                  </div>
                )}
              </Card>
            </div>

            {/* Side Panel */}
            <div className="lg:col-span-1 space-y-4">
              {/* Market Info */}
              <Card className="p-4">
                <h4 className="font-semibold mb-3 gradient-text">Market Info</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Symbol:</span>
                    <span className="text-white font-mono">BTC/USD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Exchange:</span>
                    <span className="text-white">BitLAB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Timezone:</span>
                    <span className="text-white">UTC+2</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Interval:</span>
                    <span className="text-white">1 Hour</span>
                  </div>
                </div>
              </Card>

              {/* Recent Data */}
              <Card className="p-4">
                <h4 className="font-semibold mb-3 gradient-text">Recent Candles</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {btcData.slice(0, 10).map((candle, index) => (
                    <div
                      key={candle.timestamp}
                      className="flex items-center justify-between p-2 rounded bg-[var(--bitcoin-gray)] hover:bg-gray-600 cursor-pointer transition-colors text-xs"
                      onClick={() => setSelectedCandle(candle)}
                    >
                      <div className="flex flex-col">
                        <span className="text-gray-400">{formatTime(candle.localTimestamp)}</span>
                        <span className="text-white font-mono">{formatPrice(candle.close)}</span>
                      </div>
                      <div className={`text-xs ${candle.close >= candle.open ? 'text-green-400' : 'text-red-400'}`}>
                        {candle.close >= candle.open ? '↗' : '↘'}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Selected Candle Details */}
              {selectedCandle && (
                <Card className="p-4">
                  <h4 className="font-semibold mb-3 gradient-text">Candle Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Time:</span>
                      <span className="text-white">{formatTime(selectedCandle.localTimestamp)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Open:</span>
                      <span className="text-white font-mono">{formatPrice(selectedCandle.open)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">High:</span>
                      <span className="text-green-400 font-mono">{formatPrice(selectedCandle.high)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Low:</span>
                      <span className="text-red-400 font-mono">{formatPrice(selectedCandle.low)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Close:</span>
                      <span className="text-white font-mono">{formatPrice(selectedCandle.close)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Volume:</span>
                      <span className="text-white">{formatVolume(selectedCandle.volume)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Change:</span>
                      <span className={`font-mono ${selectedCandle.close >= selectedCandle.open ? 'text-green-400' : 'text-red-400'}`}>
                        {((selectedCandle.close - selectedCandle.open) / selectedCandle.open * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
} 