'use client';

import React from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Move, 
  Maximize2, 
  RotateCcw,
  Settings,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus
} from 'lucide-react';
import { BTCHourlyData } from '@/hooks/useBTCHourly';

interface AdvancedCandlestickChartProps {
  data: BTCHourlyData[];
  chartType?: 'candlestick' | 'line' | 'area';
  showVolume?: boolean;
  height?: number;
  onCandleClick?: (candle: BTCHourlyData) => void;
  title?: string;
}

const AdvancedCandlestickChart: React.FC<AdvancedCandlestickChartProps> = ({
  data,
  chartType = 'candlestick',
  showVolume = true,
  height = 600,
  onCandleClick,
  title = 'Bitcoin Price Chart'
}) => {
  const chartRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const crosshairRef = React.useRef<HTMLDivElement>(null);
  const [chartLibLoaded, setChartLibLoaded] = React.useState(false);
  const [chart, setChartInstance] = React.useState<any>(null);
  const [isResetting, setIsResetting] = React.useState(false);
  const [mousePosition, setMousePosition] = React.useState<{x: number, y: number} | null>(null);
  const [hoveredCandle, setHoveredCandle] = React.useState<BTCHourlyData | null>(null);
  const [zoomMode, setZoomMode] = React.useState<'xy' | 'x' | 'y'>('xy');
  const [panMode, setPanMode] = React.useState(false);
  const [autoScale, setAutoScale] = React.useState(true);

  React.useEffect(() => {
    const loadChart = async () => {
      try {
        // Import Chart.js and required components
        const ChartJS = await import('chart.js/auto');
        const { CandlestickController, CandlestickElement } = await import('chartjs-chart-financial');
        const { _adapters } = await import('chartjs-adapter-date-fns');
        const zoomPlugin = await import('chartjs-plugin-zoom');

        // Register the candlestick controller and element
        ChartJS.default.register(CandlestickController, CandlestickElement, zoomPlugin.default);

        setChartLibLoaded(true);
      } catch (error) {
        console.error('Error loading Chart.js:', error);
      }
    };

    loadChart();
  }, []);

  // Store the processed chart data for mouse events
  const [chartDataForEvents, setChartDataForEvents] = React.useState<BTCHourlyData[]>([]);

  // Mouse event handlers for crosshair
  const handleMouseMove = React.useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!chart || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const canvasRect = chartRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    
    const x = event.clientX - canvasRect.left;
    const y = event.clientY - canvasRect.top;
    
    setMousePosition({ x, y });
    
    // Get data point at mouse position
    const points = chart.getElementsAtEventForMode(event.nativeEvent, 'nearest', { intersect: false }, true);
    if (points.length > 0) {
      const point = points[0];
      const dataIndex = point.index;
      // Use the processed chart data instead of original data array
      if (chartDataForEvents[dataIndex]) {
        const hoveredData = chartDataForEvents[dataIndex];
        console.log('Hovered candle:', {
          index: dataIndex,
          timestamp: hoveredData.timestamp,
          localTimestamp: hoveredData.localTimestamp,
          date: new Date((hoveredData.localTimestamp || hoveredData.timestamp) * 1000).toISOString()
        });
        setHoveredCandle(hoveredData);
        if (onCandleClick) {
          // Update selected candle for the parent component
          onCandleClick(hoveredData);
        }
      }
    }
  }, [chart, chartDataForEvents, onCandleClick]);

  const handleMouseLeave = React.useCallback(() => {
    setMousePosition(null);
    setHoveredCandle(null);
  }, []);

  // Utility function to deduplicate data
  const deduplicateData = (data: BTCHourlyData[]): BTCHourlyData[] => {
    const uniqueMap = new Map<number, BTCHourlyData>();
    
    data.forEach(item => {
      const timestamp = typeof item.timestamp === 'string' 
        ? new Date(item.timestamp).getTime() / 1000
        : (item.localTimestamp || item.timestamp);
      
      // Keep the most recent entry for each timestamp
      if (!uniqueMap.has(timestamp) || uniqueMap.get(timestamp)!.timestamp < item.timestamp) {
        uniqueMap.set(timestamp, item);
      }
    });
    
    // Sort in ascending chronological order (oldest first, newest last)
    // This ensures newest candles appear on the right side of the chart
    return Array.from(uniqueMap.values()).sort((a, b) => {
      const aTime = typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : (a.localTimestamp || a.timestamp);
      const bTime = typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : (b.localTimestamp || b.timestamp);
      return (aTime as number) - (bTime as number);
    });
  };

  // Chart creation with enhanced features
  React.useEffect(() => {
    if (!chartLibLoaded || !chartRef.current || !data?.length) return;

    const createChart = async () => {
      const { default: Chart } = await import('chart.js/auto');

      if (chart) {
        chart.destroy();
      }

      const ctx = chartRef.current?.getContext('2d');
      if (!ctx) return;

      // Deduplicate data once for all processing
      const uniqueData = deduplicateData(data);
      
      // Store the processed data for mouse events
      setChartDataForEvents(uniqueData);

      // Prepare data based on chart type
      let chartData: any[] = [];
      let datasets: any[] = [];

      if (chartType === 'candlestick') {

        chartData = uniqueData.map((item: any) => ({
          x: typeof item.timestamp === 'string' ? new Date(item.timestamp).getTime() : 
             (item.localTimestamp ? item.localTimestamp * 1000 : item.timestamp * 1000),
          o: item.open,
          h: item.high,
          l: item.low,
          c: item.close
        }));

        datasets.push({
          label: 'BTC/USD',
          data: chartData,
          borderColor: (ctx: any) => {
            const point = ctx.parsed;
            return point.c >= point.o ? '#00C851' : '#FF4444';
          },
          backgroundColor: (ctx: any) => {
            const point = ctx.parsed;
            return point.c >= point.o ? 'rgba(0, 200, 81, 0.8)' : 'rgba(255, 68, 68, 0.8)';
          },
          borderWidth: 1,
        });
      } else if (chartType === 'line') {
        chartData = uniqueData.map((item: any) => ({
          x: typeof item.timestamp === 'string' ? new Date(item.timestamp).getTime() : 
             (item.localTimestamp ? item.localTimestamp * 1000 : item.timestamp * 1000),
          y: item.close
        }));

        datasets.push({
          label: 'BTC/USD',
          data: chartData,
          borderColor: '#F7931A',
          backgroundColor: 'rgba(247, 147, 26, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
        });
      } else if (chartType === 'area') {
        chartData = uniqueData.map((item: any) => ({
          x: typeof item.timestamp === 'string' ? new Date(item.timestamp).getTime() : 
             (item.localTimestamp ? item.localTimestamp * 1000 : item.timestamp * 1000),
          y: item.close
        }));

        datasets.push({
          label: 'BTC/USD',
          data: chartData,
          borderColor: '#F7931A',
          backgroundColor: 'rgba(247, 147, 26, 0.2)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
        });
      }

      // Add volume dataset if enabled
      if (showVolume && chartType === 'candlestick') {
        const volumeData = uniqueData.map((item: any) => ({
          x: typeof item.timestamp === 'string' ? new Date(item.timestamp).getTime() : 
             (item.localTimestamp ? item.localTimestamp * 1000 : item.timestamp * 1000),
          y: item.volume
        }));

        datasets.push({
          label: 'Volume',
          data: volumeData,
          type: 'bar',
          backgroundColor: 'rgba(128, 128, 128, 0.3)',
          borderColor: 'rgba(128, 128, 128, 0.5)',
          borderWidth: 1,
          yAxisID: 'volume',
          order: 1,
        });
      }

      // Calculate bounds using deduplicated data
      const allPrices = uniqueData.flatMap((d: BTCHourlyData) => [d.open, d.high, d.low, d.close]);
      const minPrice = Math.min(...allPrices);
      const maxPrice = Math.max(...allPrices);
      const priceRange = maxPrice - minPrice;
      const padding = priceRange * 0.05;

      const allTimes = chartData.map(d => d.x);
      const minTime = Math.min(...allTimes);
      const maxTime = Math.max(...allTimes);

      const scales: any = {
        x: {
          type: 'time',
          time: {
            unit: 'hour',
            displayFormats: {
              hour: 'MMM dd HH:mm',
              day: 'MMM dd',
              week: 'MMM dd',
              month: 'MMM yyyy'
            }
          },
          grid: {
            display: true,
            color: 'rgba(255, 255, 255, 0.1)',
            lineWidth: 0.5
          },
          ticks: {
            color: '#888',
            maxTicksLimit: 8,
            autoSkip: true,
            maxRotation: 0
          },
          bounds: 'data'
        },
        y: {
          type: 'linear',
          position: 'right',
          grid: {
            display: true,
            color: 'rgba(255, 255, 255, 0.1)',
            lineWidth: 0.5
          },
          ticks: {
            color: '#888',
            maxTicksLimit: 10,
            callback: function(value: any) {
              return '$' + Number(value).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              });
            }
          },
          bounds: autoScale ? 'data' : 'ticks',
          ...(autoScale ? {} : { min: minPrice - padding, max: maxPrice + padding })
        }
      };

      // Add volume scale if needed
      if (showVolume && chartType === 'candlestick') {
        scales.volume = {
          type: 'linear',
          position: 'left',
          grid: {
            display: false
          },
          ticks: {
            display: false
          },
          max: Math.max(...uniqueData.map((d: BTCHourlyData) => d.volume)) * 4,
          min: 0
        };
      }

      const newChart = new Chart(ctx, {
        type: chartType === 'candlestick' ? 'candlestick' as any : chartType === 'line' ? 'line' : 'line',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          scales,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#fff',
                font: { size: 12 },
                filter: (item: any) => item.text !== 'Volume'
              }
            },
            tooltip: {
              enabled: false, // We'll use custom tooltip
            },
            zoom: {
              limits: {
                x: { min: minTime, max: maxTime },
                y: autoScale ? undefined : { min: minPrice - padding, max: maxPrice + padding }
              },
              pan: {
                enabled: panMode,
                mode: zoomMode,
                modifierKey: panMode ? null : 'ctrl',
                threshold: 5
              },
              zoom: {
                wheel: {
                  enabled: true,
                  speed: 0.1,
                  modifierKey: zoomMode === 'x' ? 'shift' : zoomMode === 'y' ? 'ctrl' : undefined
                },
                pinch: { enabled: true },
                mode: zoomMode,
                onZoomComplete: (chartInstance: any) => {
                  if (autoScale && chartInstance && chartInstance.scales && chartInstance.scales.x) {
                    try {
                      // Auto-scale Y axis after zoom
                      const xScale = chartInstance.scales.x;
                      const min = xScale.min;
                      const max = xScale.max;
                      
                      if (min && max) {
                        // Use the same processed data that was used for chart creation
                        const visibleData = uniqueData.filter((d: BTCHourlyData) => {
                          const timestamp = typeof d.timestamp === 'string' ? new Date(d.timestamp).getTime() : 
                                           (d.localTimestamp ? d.localTimestamp * 1000 : d.timestamp * 1000);
                          return timestamp >= min && timestamp <= max;
                        });
                        
                        if (visibleData.length > 0) {
                          const visiblePrices = visibleData.flatMap((d: BTCHourlyData) => [d.open, d.high, d.low, d.close]);
                          const visibleMin = Math.min(...visiblePrices);
                          const visibleMax = Math.max(...visiblePrices);
                          const visibleRange = visibleMax - visibleMin;
                          const visiblePadding = visibleRange * 0.05;
                          
                          if (chartInstance.options?.scales?.y) {
                            chartInstance.options.scales.y.min = visibleMin - visiblePadding;
                            chartInstance.options.scales.y.max = visibleMax + visiblePadding;
                            chartInstance.update('none');
                          }
                        }
                      }
                    } catch (error) {
                      console.warn('Error in onZoomComplete:', error);
                    }
                  }
                }
              }
            } as any
          },
          layout: {
            padding: { top: 10, right: 60, bottom: 10, left: 10 }
          },
          animation: { duration: 200 },
          elements: {
            point: { radius: 0, hoverRadius: 4 }
          },
          onHover: (event: any, elements: any[]) => {
            if (chartRef.current) {
              chartRef.current.style.cursor = elements.length > 0 ? 'crosshair' : 'default';
            }
          }
        }
      });

      setChartInstance(newChart);
    };

    createChart();

    return () => {
      if (chart) {
        chart.destroy();
      }
    };
  }, [chartLibLoaded, data, chartType, showVolume, zoomMode, panMode, autoScale]);

  // Control functions
  const resetZoom = () => {
    if (chart && chart.resetZoom) {
      try {
        setIsResetting(true);
        chart.resetZoom();
        setTimeout(() => setIsResetting(false), 300);
      } catch (error) {
        console.warn('Error resetting zoom:', error);
        setIsResetting(false);
      }
    }
  };

  const zoomIn = () => {
    if (chart && chart.zoom) {
      try {
        chart.zoom(1.2);
      } catch (error) {
        console.warn('Error zooming in:', error);
      }
    }
  };

  const zoomOut = () => {
    if (chart && chart.zoom) {
      try {
        chart.zoom(0.8);
      } catch (error) {
        console.warn('Error zooming out:', error);
      }
    }
  };

  const toggleAutoScale = () => {
    setAutoScale(!autoScale);
  };

  const setZoomModeHandler = (mode: 'xy' | 'x' | 'y') => {
    setZoomMode(mode);
    if (chart && chart.options?.plugins?.zoom?.zoom) {
      try {
        chart.options.plugins.zoom.zoom.mode = mode;
        chart.options.plugins.zoom.pan.mode = mode;
        chart.update('none');
      } catch (error) {
        console.warn('Error setting zoom mode:', error);
      }
    }
  };

  const togglePanMode = () => {
    setPanMode(!panMode);
  };

  // Format functions
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
    return volume.toFixed(0);
  };

  if (!data?.length) {
    return (
      <div className="w-full bg-[var(--card-background)] rounded-lg flex items-center justify-center" style={{ height: `${height}px` }}>
        <div className="text-gray-400 text-lg">Loading chart data...</div>
      </div>
    );
  }

  // Since data comes from API in descending order (newest first), 
  // use index 0 for latest and index 1 for previous
  const latestPrice = data[0]?.close || 0;
  const previousPrice = data[1]?.close || 0;
  const priceChange = latestPrice - previousPrice;
  const priceChangePercent = previousPrice ? (priceChange / previousPrice) * 100 : 0;
  const isPositive = priceChange >= 0;

  return (
    <div className="w-full bg-[var(--card-background)] rounded-lg border border-[var(--border-color)]" style={{ height: `${height}px` }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)]">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold text-white">
              {formatPrice(latestPrice)}
            </span>
            <span className={`text-sm font-medium flex items-center ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {isPositive ? '+' : ''}{formatPrice(priceChange)} ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        
        {/* Chart Controls */}
        <div className="flex items-center space-x-1">
          {/* Zoom Mode Selector */}
          <div className="flex items-center bg-[var(--bitcoin-gray)] rounded-md p-1 mr-2">
            <button
              onClick={() => setZoomModeHandler('xy')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                zoomMode === 'xy' ? 'bg-bitcoin-orange text-black' : 'text-gray-300 hover:text-white'
              }`}
              title="Zoom X & Y"
            >
              XY
            </button>
            <button
              onClick={() => setZoomModeHandler('x')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                zoomMode === 'x' ? 'bg-bitcoin-orange text-black' : 'text-gray-300 hover:text-white'
              }`}
              title="Zoom X only"
            >
              X
            </button>
            <button
              onClick={() => setZoomModeHandler('y')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                zoomMode === 'y' ? 'bg-bitcoin-orange text-black' : 'text-gray-300 hover:text-white'
              }`}
              title="Zoom Y only"
            >
              Y
            </button>
          </div>

          <button
            onClick={zoomIn}
            className="p-1.5 bg-[var(--bitcoin-gray)] text-gray-300 rounded hover:bg-gray-600 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          
          <button
            onClick={zoomOut}
            className="p-1.5 bg-[var(--bitcoin-gray)] text-gray-300 rounded hover:bg-gray-600 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <button
            onClick={togglePanMode}
            className={`p-1.5 rounded transition-colors ${
              panMode 
                ? 'bg-bitcoin-orange text-black' 
                : 'bg-[var(--bitcoin-gray)] text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
            title="Toggle Pan Mode"
          >
            <Move className="h-4 w-4" />
          </button>

          <button
            onClick={toggleAutoScale}
            className={`p-1.5 rounded transition-colors ${
              autoScale 
                ? 'bg-bitcoin-orange text-black' 
                : 'bg-[var(--bitcoin-gray)] text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
            title="Auto Scale Y-Axis"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <button
            onClick={resetZoom}
            disabled={isResetting}
            className="p-1.5 bg-[var(--bitcoin-gray)] text-gray-300 rounded hover:bg-gray-600 hover:text-white transition-colors disabled:opacity-50"
            title="Reset Zoom"
          >
            <RotateCcw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div 
        ref={containerRef}
        className="relative w-full"
        style={{ height: `${height - 60}px` }}
      >
        <canvas
          ref={chartRef}
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ backgroundColor: 'transparent' }}
        />

        {/* Crosshair */}
        {mousePosition && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: mousePosition.x,
              top: mousePosition.y,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {/* Vertical line */}
            <div
              className="absolute bg-gray-400 opacity-50"
              style={{
                left: '50%',
                top: `-${height/2}px`,
                width: '1px',
                height: `${height}px`,
                transform: 'translateX(-50%)'
              }}
            />
            {/* Horizontal line */}
            <div
              className="absolute bg-gray-400 opacity-50"
              style={{
                top: '50%',
                left: '-50vw',
                width: '100vw',
                height: '1px',
                transform: 'translateY(-50%)'
              }}
            />
          </div>
        )}

        {/* Custom Tooltip */}
        {hoveredCandle && mousePosition && containerRef.current && (
          <div
            className="absolute bg-black/90 text-white p-3 rounded-lg border border-gray-600 pointer-events-none z-10 min-w-48"
            style={{
              left: mousePosition.x + 15,
              top: mousePosition.y - 10,
              transform: mousePosition.x > containerRef.current.clientWidth - 200 ? 'translateX(-100%) translateX(-15px)' : undefined
            }}
          >
            <div className="text-xs text-gray-400 mb-1">
              {formatTime(hoveredCandle.localTimestamp ? hoveredCandle.localTimestamp * 1000 : 
                         typeof hoveredCandle.timestamp === 'string' ? new Date(hoveredCandle.timestamp).getTime() : 
                         hoveredCandle.timestamp * 1000)}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Open:</span>
                <span className="font-mono">{formatPrice(hoveredCandle.open)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">High:</span>
                <span className="font-mono text-green-400">{formatPrice(hoveredCandle.high)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Low:</span>
                <span className="font-mono text-red-400">{formatPrice(hoveredCandle.low)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Close:</span>
                <span className="font-mono">{formatPrice(hoveredCandle.close)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Volume:</span>
                <span className="font-mono">{formatVolume(hoveredCandle.volume)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-600 pt-1">
                <span className="text-gray-400">Change:</span>
                <span className={`font-mono ${hoveredCandle.close >= hoveredCandle.open ? 'text-green-400' : 'text-red-400'}`}>
                  {((hoveredCandle.close - hoveredCandle.open) / hoveredCandle.open * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="absolute bottom-2 left-2 text-xs text-gray-500 bg-black/50 px-2 py-1 rounded">
          {zoomMode === 'xy' && 'Scroll: Zoom • Drag: Pan'}
          {zoomMode === 'x' && 'Shift+Scroll: Zoom X • Drag: Pan X'}
          {zoomMode === 'y' && 'Ctrl+Scroll: Zoom Y • Drag: Pan Y'}
          {panMode && ' • Pan Mode Active'}
        </div>
      </div>
    </div>
  );
};

export default AdvancedCandlestickChart;
