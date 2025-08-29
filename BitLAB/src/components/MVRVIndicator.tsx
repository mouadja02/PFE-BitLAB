'use client';

import React from 'react';
import { useOnchainStrategy } from '@/hooks/useOnchainStrategy';
import { TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';

export const MVRVIndicator: React.FC = () => {
  const { data, isLoading, error } = useOnchainStrategy(30);

  if (isLoading) {
    return (
      <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="h-5 w-5 text-bitcoin-orange" />
          <h3 className="text-lg font-semibold text-white">MVRV Ratio</h3>
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="h-2 bg-gray-600 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-6 glow-border">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="h-5 w-5 text-bitcoin-orange" />
          <h3 className="text-lg font-semibold text-white">MVRV Ratio</h3>
        </div>
        <div className="text-center text-gray-400">
          <p>Unable to load MVRV data</p>
        </div>
      </div>
    );
  }

  const currentMVRV = data[0]?.mvrv || 0;
  const previousMVRV = data[1]?.mvrv || 0;
  const change = currentMVRV - previousMVRV;
  const changePercent = previousMVRV !== 0 ? (change / previousMVRV) * 100 : 0;

  const getMVRVStatus = (mvrv: number) => {
    if (mvrv > 3.7) return { status: 'Overvalued', color: 'text-red-500', bgColor: 'bg-red-500' };
    if (mvrv > 2.4) return { status: 'Expensive', color: 'text-orange-500', bgColor: 'bg-orange-500' };
    if (mvrv > 1.0) return { status: 'Fair Value', color: 'text-yellow-400', bgColor: 'bg-yellow-400' };
    if (mvrv > 0.8) return { status: 'Undervalued', color: 'text-green-400', bgColor: 'bg-green-400' };
    return { status: 'Deeply Undervalued', color: 'text-green-500', bgColor: 'bg-green-500' };
  };

  const mvrvStatus = getMVRVStatus(currentMVRV);

  const getIcon = () => {
    if (change > 0) return <TrendingUp className="h-4 w-4" />;
    if (change < 0) return <TrendingDown className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate 30-day average
  const avgMVRV = Array.isArray(data) && data.length > 0 
    ? data.reduce((sum, item) => sum + (item?.mvrv || 0), 0) / data.length 
    : 0;

  return (
    <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-6 glow-border">
      <div className="flex items-center space-x-2 mb-6">
        <Activity className="h-5 w-5 text-bitcoin-orange" />
        <h3 className="text-lg font-semibold text-white">MVRV Ratio</h3>
      </div>

      {/* Current Value */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Current Value</span>
          <div className="flex items-center space-x-2">
            <span className={`text-sm ${change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {change > 0 ? '+' : ''}{changePercent.toFixed(2)}%
            </span>
            <span className={change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'}>
              {getIcon()}
            </span>
          </div>
        </div>
        
        <div className="text-3xl font-bold text-white mb-2">
          {currentMVRV.toFixed(2)}
        </div>
        
        <div className="flex items-center space-x-2 mb-3">
          <span className={`text-sm font-medium ${mvrvStatus.color}`}>
            {mvrvStatus.status}
          </span>
          {currentMVRV > 3.7 && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>

        {/* Status Bar */}
        <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${mvrvStatus.bgColor}`}
            style={{ width: `${Math.min((currentMVRV / 5) * 100, 100)}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-400">
          <span>Undervalued (0.8)</span>
          <span>Fair (1.0)</span>
          <span>Expensive (2.4)</span>
          <span>Overvalued (3.7+)</span>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[var(--bitcoin-gray)] rounded-lg p-3 text-center">
          <div className="text-sm font-bold text-white">
            {avgMVRV.toFixed(2)}
          </div>
          <div className="text-xs text-gray-400">30-Day Avg</div>
        </div>
        <div className="bg-[var(--bitcoin-gray)] rounded-lg p-3 text-center">
          <div className="text-sm font-bold text-white">
            {Array.isArray(data) && data.length > 0 
              ? Math.max(...data.map(d => d?.mvrv || 0)).toFixed(2)
              : '0.00'
            }
          </div>
          <div className="text-xs text-gray-400">30-Day High</div>
        </div>
      </div>

      {/* Recent Trend */}
      <div>
        <h4 className="text-sm font-medium text-white mb-3">Recent Trend (Last 7 Days)</h4>
        <div className="space-y-2">
          {Array.isArray(data) ? data.slice(0, 7).map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {formatDate(item?.date || '')}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-white font-medium">
                  {(item?.mvrv || 0).toFixed(2)}
                </span>
                <span className={`text-xs ${getMVRVStatus(item?.mvrv || 0).color}`}>
                  {getMVRVStatus(item?.mvrv || 0).status}
                </span>
              </div>
            </div>
          )) : (
            <div className="text-center text-gray-400 text-sm">
              <p>No trend data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 