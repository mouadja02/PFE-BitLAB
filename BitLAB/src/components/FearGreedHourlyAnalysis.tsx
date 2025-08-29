'use client';

import React from 'react';
import { useFearGreedHourly } from '@/hooks/useFearGreedHourly';
import { TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';

export const FearGreedHourlyAnalysis: React.FC = () => {
  const { data, isLoading, error } = useFearGreedHourly(48); // Last 48 hours

  if (isLoading) {
    return (
      <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="h-5 w-5 text-bitcoin-orange" />
          <h3 className="text-lg font-semibold text-white">Fear & Greed Hourly Analysis</h3>
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="h-2 bg-gray-600 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="h-5 w-5 text-bitcoin-orange" />
          <h3 className="text-lg font-semibold text-white">Fear & Greed Hourly Analysis</h3>
        </div>
        <div className="text-center text-gray-400">
          <p>Unable to load fear & greed data</p>
        </div>
      </div>
    );
  }

  const getSentimentColor = (classification: string) => {
    switch (classification?.toLowerCase()) {
      case 'extreme greed':
        return 'text-green-500';
      case 'greed':
        return 'text-green-400';
      case 'neutral':
        return 'text-yellow-400';
      case 'fear':
        return 'text-orange-400';
      case 'extreme fear':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const getSentimentBgColor = (classification: string) => {
    switch (classification?.toLowerCase()) {
      case 'extreme greed':
        return 'bg-green-500';
      case 'greed':
        return 'bg-green-400';
      case 'neutral':
        return 'bg-yellow-400';
      case 'fear':
        return 'bg-orange-400';
      case 'extreme fear':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getSentimentIcon = (classification: string) => {
    switch (classification?.toLowerCase()) {
      case 'extreme greed':
      case 'greed':
        return <TrendingUp className="h-4 w-4" />;
      case 'extreme fear':
      case 'fear':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const formatTime = (date: string, time: string) => {
    const dateTime = new Date(`${date}T${time}`);
    return dateTime.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const currentData = Array.isArray(data) && data.length > 0 ? data[0] : null;
  const previousData = Array.isArray(data) && data.length > 1 ? data[1] : null;
  const scoreChange = previousData && currentData ? currentData.score - previousData.score : 0;

  // Calculate trend over last 24 hours
  const last24Hours = Array.isArray(data) ? data.slice(0, 24) : [];
  const avgScore = last24Hours.length > 0 
    ? last24Hours.reduce((sum, item) => sum + (item?.score || 0), 0) / last24Hours.length 
    : 0;

  if (!currentData) {
    return (
      <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-6 glow-border">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="h-5 w-5 text-bitcoin-orange" />
          <h3 className="text-lg font-semibold text-white">Fear & Greed Hourly Analysis</h3>
        </div>
        <div className="text-center text-gray-400">
          <p>No hourly data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-6 glow-border">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-bitcoin-orange" />
          <h3 className="text-lg font-semibold text-white">Fear & Greed Hourly Analysis</h3>
        </div>
        <div className="text-xs text-gray-400">
          <Clock className="h-3 w-3 inline mr-1" />
          {formatTime(currentData.date, currentData.time)}
        </div>
      </div>

      {/* Current Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className={getSentimentColor(currentData.classification)}>
              {getSentimentIcon(currentData.classification)}
            </span>
            <span className="text-white font-medium">Current Score</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-white">{currentData.score}</span>
            {scoreChange !== 0 && (
              <span className={`text-sm ${scoreChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {scoreChange > 0 ? '+' : ''}{scoreChange.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium ${getSentimentColor(currentData.classification)}`}>
            {currentData.classification}
          </span>
          <span className="text-xs text-gray-400">
            24h Avg: {avgScore.toFixed(1)}
          </span>
        </div>

        {/* Score Bar */}
        <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${getSentimentBgColor(currentData.classification)}`}
            style={{ width: `${currentData.score}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-400">
          <span>Extreme Fear (0)</span>
          <span>Neutral (50)</span>
          <span>Extreme Greed (100)</span>
        </div>
      </div>

      {/* Recent Trend */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-white mb-3">Recent Trend (Last 12 Hours)</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {Array.isArray(data) ? data.slice(0, 12).map((item, index) => (
            <div key={index} className="flex items-center justify-between py-1">
              <div className="flex items-center space-x-2">
                <span className={getSentimentColor(item?.classification || '')}>
                  {getSentimentIcon(item?.classification || '')}
                </span>
                <span className="text-xs text-gray-400">
                  {formatTime(item?.date || '', item?.time || '')}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-white font-medium">{item?.score || 0}</span>
                <span className={`text-xs ${getSentimentColor(item?.classification || '')}`}>
                  {item?.classification || 'Unknown'}
                </span>
              </div>
            </div>
          )) : (
            <div className="text-center text-gray-400 text-sm">
              <p>No recent trend data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Mini Chart */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-white mb-3">Score Trend (Last 24 Hours)</h4>
        <div className="flex items-end space-x-1 h-16">
          {Array.isArray(data) ? data.slice(0, 24).reverse().map((item, index) => (
            <div
              key={index}
              className="flex-1 bg-gray-700 rounded-t"
              style={{ 
                height: `${((item?.score || 0) / 100) * 100}%`,
                minHeight: '2px'
              }}
              title={`${formatTime(item?.date || '', item?.time || '')}: ${item?.score || 0} (${item?.classification || 'Unknown'})`}
            >
              <div
                className={`w-full rounded-t transition-all duration-300 ${getSentimentBgColor(item?.classification || '')}`}
                style={{ height: '100%' }}
              ></div>
            </div>
          )) : (
            <div className="text-center text-gray-400 text-sm">
              <p>No chart data available</p>
            </div>
          )}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>24h ago</span>
          <span>Now</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--bitcoin-gray)] rounded p-3 text-center">
          <div className="text-xs text-gray-400 mb-1">Highest</div>
          <div className="text-sm font-bold text-white">
            {last24Hours.length > 0 ? Math.max(...last24Hours.map(d => d?.score || 0)) : 0}
          </div>
        </div>
        <div className="bg-[var(--bitcoin-gray)] rounded p-3 text-center">
          <div className="text-xs text-gray-400 mb-1">Lowest</div>
          <div className="text-sm font-bold text-white">
            {last24Hours.length > 0 ? Math.min(...last24Hours.map(d => d?.score || 0)) : 0}
          </div>
        </div>
        <div className="bg-[var(--bitcoin-gray)] rounded p-3 text-center">
          <div className="text-xs text-gray-400 mb-1">Volatility</div>
          <div className="text-sm font-bold text-white">
            {last24Hours.length > 0 
              ? (Math.max(...last24Hours.map(d => d?.score || 0)) - Math.min(...last24Hours.map(d => d?.score || 0))).toFixed(0)
              : '0'
            }
          </div>
        </div>
      </div>
    </div>
  );
}; 