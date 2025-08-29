"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/Card';
import { 
  ZoomIn, 
  ZoomOut, 
  RefreshCw, 
  Database, 
  LineChart as LineChartIcon, 
  Table, 
  Settings,
  TrendingUp,
  BarChart3,
  Activity,
  Plus,
  Minus,
  RotateCcw,
  Download,
  Maximize2
} from 'lucide-react';

// Types for the tables and columns
interface TableInfo {
  TABLE_NAME: string;
}

interface ColumnInfo {
  COLUMN_NAME: string;
  DATA_TYPE: string;
}

// Enhanced chart configuration types
interface ChartDataset {
  label: string;
  data: any[];
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  pointRadius: number;
  pointHoverRadius: number;
  tension: number;
  fill: boolean;
  yAxisID: string;
  type?: 'line' | 'bar';
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

interface MovingAverageConfig {
  enabled: boolean;
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
}

interface YAxisConfig {
  id: string;
  position: 'left' | 'right';
  type: 'linear' | 'logarithmic';
  title: string;
  color: string;
}

// Dynamically import Chart.js to avoid SSR issues
const Chart = dynamic(
  () => import('./ChartComponent'),
  { ssr: false }
);

// Define chart colors
const CHART_COLORS = [
  '#F7931A', // Bitcoin orange
  '#3498db', // Blue
  '#2ecc71', // Green
  '#e74c3c', // Red
  '#9b59b6', // Purple
  '#f1c40f', // Yellow
  '#1abc9c', // Turquoise
  '#e67e22', // Orange
  '#34495e', // Dark gray
  '#95a5a6', // Light gray
];

const MA_COLORS = [
  '#ff6b6b', // Red for MA
  '#4ecdc4', // Teal for MA
  '#45b7d1', // Light blue for MA
  '#96ceb4', // Light green for MA
];

export default function AnalyticsPage() {
  // State for tables and columns
  const [tables, setTables] = React.useState<TableInfo[]>([]);
  const [columns, setColumns] = React.useState<ColumnInfo[]>([]);
  const [isLoadingTables, setIsLoadingTables] = React.useState(true);
  const [isLoadingColumns, setIsLoadingColumns] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // State for selected table and columns
  const [selectedTable, setSelectedTable] = React.useState<string>('');
  const [selectedColumns, setSelectedColumns] = React.useState<string[]>([]);
  const [xAxisColumn, setXAxisColumn] = React.useState<string>('');

  // State for chart data and configuration
  const [chartData, setChartData] = React.useState<ChartData | null>(null);
  const [rawData, setRawData] = React.useState<any[]>([]);
  const [yAxes, setYAxes] = React.useState<YAxisConfig[]>([]);
  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');

  // State for advanced features
  const [movingAverages, setMovingAverages] = React.useState<MovingAverageConfig[]>([]);
  const [btcPriceOverlay, setBtcPriceOverlay] = React.useState(false);
  const [chartType, setChartType] = React.useState<'line' | 'bar'>('line');
  const [timeframe, setTimeframe] = React.useState<'1h' | '1d' | '1w' | '1m'>('1d');

  // Fetch tables when component mounts
  React.useEffect(() => {
    const fetchTables = async () => {
      setIsLoadingTables(true);
      setError(null);
      
      try {
        const response = await fetch('/api/snowflake/tables');
        if (!response.ok) {
          throw new Error('Failed to fetch tables');
        }
        
        const data = await response.json();
        setTables(data);
      } catch (err: any) {
        console.error('Error loading tables:', err);
        setError(`Failed to load tables: ${err.message}`);
      } finally {
        setIsLoadingTables(false);
      }
    };
    
    fetchTables();
  }, []);

  // Fetch columns when table is selected
  React.useEffect(() => {
    const fetchColumns = async () => {
      if (!selectedTable) return;
      
      setIsLoadingColumns(true);
      setError(null);
      setSelectedColumns([]);
      setXAxisColumn('');
      setYAxes([]);
      
      try {
        const response = await fetch(`/api/snowflake/columns?table=${selectedTable}`);
        if (!response.ok) {
          throw new Error('Failed to fetch columns');
        }
        
        const data = await response.json();
        setColumns(data);
        
        // Auto select the first date/timestamp column as x-axis, or first column if no date columns
        const dateColumn = data.find((col: ColumnInfo) => 
          ['DATE', 'TIMESTAMP_NTZ', 'TIMESTAMP_LTZ'].includes(col.DATA_TYPE.toUpperCase())
        );
        if (dateColumn) {
          setXAxisColumn(dateColumn.COLUMN_NAME);
        } else if (data.length > 0) {
          setXAxisColumn(data[0].COLUMN_NAME);
        }
      } catch (err: any) {
        console.error('Error loading columns:', err);
        setError(`Failed to load columns: ${err.message}`);
      } finally {
        setIsLoadingColumns(false);
      }
    };
    
    fetchColumns();
  }, [selectedTable]);

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
        ema.push((data[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
      }
      return ema;
    }
  };

  // Format date labels based on timeframe
  const formatDateLabel = (dateStr: string, isHourly: boolean = false): string => {
    const date = new Date(dateStr);
    
    if (isHourly) {
      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`;
    }
  };

  // Fetch data and prepare chart
  const fetchData = async () => {
    if (!selectedTable || !xAxisColumn || selectedColumns.length === 0) return;
    
    setIsLoadingData(true);
    setError(null);
    
    try {
      const columnsParam = [xAxisColumn, ...selectedColumns].join(',');
      let url = `/api/snowflake/data?table=${selectedTable}&columns=${columnsParam}`;
      
      // Add date range parameters if provided
      if (startDate) {
        url += `&startDate=${startDate}`;
      }
      if (endDate) {
        url += `&endDate=${endDate}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const data = await response.json();
      setRawData(data);
      
      // Determine if this is hourly data
      const isHourlyData = selectedTable.includes('HOURLY') || 
                          columns.some(col => col.COLUMN_NAME.includes('HOUR'));
      
      // Prepare chart data
      prepareChartData(data, xAxisColumn, selectedColumns, isHourlyData);
      
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(`Failed to fetch data: ${err.message}`);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Prepare chart data with enhanced features
  const prepareChartData = (data: any[], xColumn: string, yColumns: string[], isHourly: boolean = false) => {
    if (!data || data.length === 0) return;

    // Sort data by x-axis (date/time)
    const sortedData = [...data].sort((a, b) => new Date(a[xColumn]).getTime() - new Date(b[xColumn]).getTime());

    // Format labels
    const labels = sortedData.map(row => formatDateLabel(row[xColumn], isHourly));

    // Create datasets for each selected column
    const datasets: ChartDataset[] = [];
    const newYAxes: YAxisConfig[] = [];

    yColumns.forEach((column, index) => {
      const values = sortedData.map(row => parseFloat(row[column]) || 0);
      const color = CHART_COLORS[index % CHART_COLORS.length];
      
      // Create Y-axis configuration
      const yAxisId = `y${index}`;
      const yAxis: YAxisConfig = {
        id: yAxisId,
        position: index % 2 === 0 ? 'left' : 'right',
        type: 'linear',
        title: column,
        color: color
      };
      newYAxes.push(yAxis);

      // Create dataset
      const dataset: ChartDataset = {
        label: column,
        data: values,
        borderColor: color,
        backgroundColor: color + '20',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1,
        fill: false,
        yAxisID: yAxisId,
        type: chartType
      };
      datasets.push(dataset);

      // Add moving averages if enabled
      movingAverages.forEach((ma, maIndex) => {
        if (ma.enabled) {
          const maValues = calculateMovingAverage(values, ma.period, ma.type);
          const maDataset: ChartDataset = {
            label: `${ma.type}(${ma.period}) - ${column}`,
            data: maValues,
            borderColor: MA_COLORS[maIndex % MA_COLORS.length],
            backgroundColor: 'transparent',
            borderWidth: 1,
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.1,
            fill: false,
            yAxisID: yAxisId,
            type: 'line'
          };
          datasets.push(maDataset);
        }
      });
    });

    // Add BTC price overlay if enabled
    if (btcPriceOverlay && selectedTable !== 'BTC_HOURLY_DATA') {
      // This would require fetching BTC price data for the same time period
      // For now, we'll just show the option in the UI
    }

    setYAxes(newYAxes);
    setChartData({ labels, datasets });
  };

  // Chart options with dual y-axes support
  const getChartOptions = () => {
    const scales: any = {
      x: {
        title: {
          display: true,
          text: xAxisColumn,
          color: '#9CA3AF'
        },
        ticks: {
          color: '#9CA3AF',
          maxTicksLimit: 10
        },
        grid: {
          color: '#374151'
        }
      }
    };

    // Add y-axes
    yAxes.forEach(yAxis => {
      scales[yAxis.id] = {
        type: yAxis.type,
        position: yAxis.position,
        title: {
          display: true,
          text: yAxis.title,
          color: yAxis.color
        },
        ticks: {
          color: yAxis.color
        },
        grid: {
          color: yAxis.position === 'left' ? '#374151' : 'transparent'
        }
      };
    });

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      scales,
      plugins: {
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: '#1F2937',
          titleColor: '#F9FAFB',
          bodyColor: '#F9FAFB',
          borderColor: '#374151',
          borderWidth: 1
        },
        legend: {
          position: 'top' as const,
          labels: {
            color: '#9CA3AF',
            padding: 20,
            usePointStyle: true
          }
        },
        title: {
          display: true,
          text: `${selectedTable} - ${selectedColumns.join(', ')}`,
          color: '#F9FAFB',
          font: {
            size: 16
          }
        }
      }
    };
  };

  // Handle column selection with y-axis assignment
  const handleColumnSelect = (column: string) => {
    setSelectedColumns(prev => {
      if (prev.includes(column)) {
        return prev.filter(col => col !== column);
      } else {
        return [...prev, column];
      }
    });
  };

  // Add moving average
  const addMovingAverage = () => {
    setMovingAverages(prev => [...prev, {
      enabled: true,
      period: 20,
      type: 'SMA',
      color: MA_COLORS[prev.length % MA_COLORS.length]
    }]);
  };

  // Remove moving average
  const removeMovingAverage = (index: number) => {
    setMovingAverages(prev => prev.filter((_, i) => i !== index));
  };

  // Update moving average
  const updateMovingAverage = (index: number, updates: Partial<MovingAverageConfig>) => {
    setMovingAverages(prev => prev.map((ma, i) => 
      i === index ? { ...ma, ...updates } : ma
    ));
  };

  // Toggle y-axis scale type
  const toggleYAxisScale = (yAxisId: string) => {
    setYAxes(prev => prev.map(axis => 
      axis.id === yAxisId 
        ? { ...axis, type: axis.type === 'linear' ? 'logarithmic' : 'linear' }
        : axis
    ));
    
    // Regenerate chart with updated axes
    if (rawData.length > 0) {
      prepareChartData(rawData, xAxisColumn, selectedColumns);
    }
  };

  // Get all columns for x-axis (not just date columns)
  const getAllColumns = () => {
    return columns;
  };

  // Get plottable columns (excluding the selected x-axis column)
  const getPlottableColumns = () => {
    return columns.filter(col => 
      ['NUMBER', 'FLOAT', 'INTEGER'].includes(col.DATA_TYPE.toUpperCase()) &&
      col.COLUMN_NAME !== xAxisColumn
    );
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white gradient-text">Bitcoin Data Charts</h1>
        <p className="mt-2 text-gray-300">
          Interactive visualization of Bitcoin data from Snowflake
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left sidebar - Data Selection */}
        <div className="lg:col-span-1">
          <Card className="p-4 glass-panel">
            <h2 className="text-lg font-semibold mb-4 flex items-center text-white">
              <Database className="mr-2" size={18} />
              Data Selection
            </h2>
            
            {/* Table Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Select Table
              </label>
              <select
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-bitcoin-orange"
                onChange={(e) => setSelectedTable(e.target.value)}
                value={selectedTable}
                disabled={isLoadingTables}
              >
                <option value="">Choose table...</option>
                {tables.map((table: TableInfo) => (
                  <option key={table.TABLE_NAME} value={table.TABLE_NAME}>
                    {table.TABLE_NAME}
                  </option>
                ))}
              </select>
            </div>
            
            {/* X-Axis Selection */}
            {selectedTable && getAllColumns().length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  X-Axis Column
                </label>
                <select
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-bitcoin-orange"
                  onChange={(e) => setXAxisColumn(e.target.value)}
                  value={xAxisColumn}
                >
                  {getAllColumns().map((column: ColumnInfo) => (
                    <option key={column.COLUMN_NAME} value={column.COLUMN_NAME}>
                      {column.COLUMN_NAME}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Y-Axis Columns */}
            {selectedTable && getPlottableColumns().length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Select Y-Axis Columns
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-600 rounded-md bg-gray-800">
                  {getPlottableColumns().map((column: ColumnInfo, index) => (
                    <div
                      key={column.COLUMN_NAME}
                      className="flex items-center p-2 hover:bg-gray-700 cursor-pointer"
                      onClick={() => handleColumnSelect(column.COLUMN_NAME)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(column.COLUMN_NAME)}
                        onChange={() => {}}
                        className="mr-2 accent-bitcoin-orange"
                      />
                      <span className="text-sm text-white flex-1">
                        {column.COLUMN_NAME}
                      </span>
                      <div 
                        className="w-3 h-3 rounded-full ml-2"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Date Range */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Date Range (Optional)
              </label>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-bitcoin-orange text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-bitcoin-orange text-sm"
                  />
                </div>
              </div>
            </div>
            
            {/* Generate Chart Button */}
            <button
              className="w-full bg-bitcoin-orange hover:bg-orange-600 text-black font-semibold py-2 px-4 rounded-md flex items-center justify-center transition-colors"
              onClick={fetchData}
              disabled={!selectedTable || !xAxisColumn || selectedColumns.length === 0 || isLoadingData}
            >
              {isLoadingData ? (
                <>
                  <RefreshCw className="mr-2 animate-spin" size={18} />
                  Generating...
                </>
              ) : (
                <>
                  <LineChartIcon className="mr-2" size={18} />
                  Generate Chart
                </>
              )}
            </button>
            
            {error && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded-md text-sm">
                {error}
              </div>
            )}
          </Card>
        </div>
        
        {/* Main chart area */}
        <div className="lg:col-span-3">
          <Card className="p-4 glass-panel">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center text-white">
                <LineChartIcon className="mr-2" size={18} />
                Chart Visualization
              </h2>
              
              {chartData && (
                <div className="flex items-center space-x-2">
                  <button
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white transition-colors"
                    onClick={() => setChartType(chartType === 'line' ? 'bar' : 'line')}
                    title="Toggle Chart Type"
                  >
                    {chartType === 'line' ? <BarChart3 size={16} /> : <LineChartIcon size={16} />}
                  </button>
                  <button
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white transition-colors"
                    title="Download Chart"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white transition-colors"
                    title="Fullscreen"
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>
              )}
            </div>
            
            <div className="h-[600px] relative">
              {!chartData && !isLoadingData && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <Database size={64} className="mb-4 opacity-20" />
                  <p className="text-center text-lg">
                    {selectedTable 
                      ? 'Select columns and click "Generate Chart" to visualize data'
                      : 'Select a table to begin'
                    }
                  </p>
                </div>
              )}
              
              {isLoadingData && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <RefreshCw size={48} className="animate-spin mb-4 text-bitcoin-orange" />
                  <p className="text-white">Loading data from Snowflake...</p>
                </div>
              )}
              
              {chartData && (
                <div className="h-full w-full">
                  <Chart 
                    data={chartData} 
                    options={getChartOptions()} 
                  />
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right sidebar - Chart Settings */}
        <div className="lg:col-span-1">
          <Card className="p-4 glass-panel mb-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center text-white">
              <Settings className="mr-2" size={18} />
              Chart Settings
            </h2>

            {/* Y-Axis Controls */}
            {yAxes.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2 text-gray-300">Y-Axis Controls</h3>
                {yAxes.map((axis, index) => (
                  <div key={axis.id} className="mb-3 p-2 bg-gray-800 rounded border border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-300 truncate" title={axis.title}>
                        {axis.title}
                      </span>
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: axis.color }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{axis.position}</span>
                      <button
                        className={`px-2 py-1 text-xs rounded ${
                          axis.type === 'logarithmic' 
                            ? 'bg-bitcoin-orange text-black' 
                            : 'bg-gray-700 text-white'
                        }`}
                        onClick={() => toggleYAxisScale(axis.id)}
                      >
                        {axis.type === 'logarithmic' ? 'Log' : 'Linear'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Moving Averages */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-300">Moving Averages</h3>
                <button
                  className="p-1 bg-bitcoin-orange hover:bg-orange-600 rounded text-black transition-colors"
                  onClick={addMovingAverage}
                  title="Add Moving Average"
                >
                  <Plus size={14} />
                </button>
              </div>
              
              {movingAverages.map((ma, index) => (
                <div key={index} className="mb-3 p-2 bg-gray-800 rounded border border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <select
                      value={ma.type}
                      onChange={(e) => updateMovingAverage(index, { type: e.target.value as 'SMA' | 'EMA' })}
                      className="text-xs bg-gray-700 border border-gray-600 rounded px-1 py-1 text-white"
                    >
                      <option value="SMA">SMA</option>
                      <option value="EMA">EMA</option>
                    </select>
                    <button
                      className="p-1 bg-red-600 hover:bg-red-700 rounded text-white transition-colors"
                      onClick={() => removeMovingAverage(index)}
                    >
                      <Minus size={12} />
                    </button>
                  </div>
                  <input
                    type="number"
                    value={ma.period}
                    onChange={(e) => updateMovingAverage(index, { period: parseInt(e.target.value) || 20 })}
                    min="2"
                    max="200"
                    className="w-full text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white"
                    placeholder="Period"
                  />
                </div>
              ))}
            </div>

            {/* BTC Price Overlay */}
            <div className="mb-4">
              <label className="flex items-center text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={btcPriceOverlay}
                  onChange={(e) => setBtcPriceOverlay(e.target.checked)}
                  className="mr-2 accent-bitcoin-orange"
                />
                Overlay BTC Price
              </label>
            </div>

            {/* Refresh Data */}
            {chartData && (
              <button
                className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-md flex items-center justify-center transition-colors"
                onClick={fetchData}
                disabled={isLoadingData}
              >
                <RefreshCw className={`mr-2 ${isLoadingData ? 'animate-spin' : ''}`} size={16} />
                Refresh Data
              </button>
            )}
          </Card>

          {/* Chart Info */}
          {chartData && (
            <Card className="p-4 glass-panel">
              <h3 className="text-sm font-semibold mb-2 text-white">Chart Info</h3>
              <div className="text-xs text-gray-300 space-y-1">
                <div>Table: {selectedTable}</div>
                <div>Data Points: {chartData.labels.length}</div>
                <div>Datasets: {chartData.datasets.length}</div>
                <div>Y-Axes: {yAxes.length}</div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
} 