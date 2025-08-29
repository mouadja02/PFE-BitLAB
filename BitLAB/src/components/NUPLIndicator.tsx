'use client';

import React from 'react';
import { useOnchainStrategy } from '@/hooks/useOnchainStrategy';
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Target } from 'lucide-react';

export const NUPLIndicator: React.FC = () => {
  const { data, isLoading, error } = useOnchainStrategy(30);

  if (isLoading) {
    return (
      <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Target className="h-5 w-5 text-bitcoin-orange" />
          <h3 className="text-lg font-semibold text-white">NUPL Indicator</h3>
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
          <Target className="h-5 w-5 text-bitcoin-orange" />
          <h3 className="text-lg font-semibold text-white">NUPL Indicator</h3>
        </div>
        <div className="text-center text-gray-400">
          <p>Unable to load NUPL data</p>
        </div>
      </div>
    );
  }

  const currentNUPL = data[0]?.nupl || 0;
  const previousNUPL = data[1]?.nupl || 0;
  const change = currentNUPL - previousNUPL;
  const changePercent = previousNUPL !== 0 ? (change / previousNUPL) * 100 : 0;

  const getNUPLStatus = (nupl: number) => {
    if (nupl > 0.75) return { status: 'Euphoria', color: 'text-red-500', bgColor: 'bg-red-500' };
    if (nupl > 0.5) return { status: 'Greed', color: 'text-orange-500', bgColor: 'bg-orange-500' };
    if (nupl > 0.25) return { status: 'Optimism', color: 'text-yellow-400', bgColor: 'bg-yellow-400' };
    if (nupl > 0) return { status: 'Hope', color: 'text-green-400', bgColor: 'bg-green-400' };
    if (nupl > -0.25) return { status: 'Fear', color: 'text-blue-400', bgColor: 'bg-blue-400' };
    if (nupl > -0.5) return { status: 'Anxiety', color: 'text-purple-400', bgColor: 'bg-purple-400' };
    return { status: 'Capitulation', color: 'text-red-600', bgColor: 'bg-red-600' };
  };

  const nuplStatus = getNUPLStatus(currentNUPL);

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
  const avgNUPL = Array.isArray(data) && data.length > 0 
    ? data.reduce((sum, item) => sum + (item?.nupl || 0), 0) / data.length 
    : 0;

  // Convert NUPL to percentage for display
  const nuplPercent = (currentNUPL * 100);
  const avgNuplPercent = (avgNUPL * 100);

  return (
    <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-6 glow-border">
      <div className="flex items-center space-x-2 mb-6">
        <Target className="h-5 w-5 text-bitcoin-orange" />
        <h3 className="text-lg font-semibold text-white">NUPL Indicator</h3>
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
          {nuplPercent.toFixed(1)}%
        </div>
        
        <div className="flex items-center space-x-2 mb-3">
          <span className={`text-sm font-medium ${nuplStatus.color}`}>
            {nuplStatus.status}
          </span>
          {(currentNUPL > 0.75 || currentNUPL < -0.5) && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>

        {/* Status Bar */}
        <div className="w-full bg-gray-700 rounded-full h-2 mb-2 relative">
          {/* Zero line marker */}
          <div className="absolute left-1/2 top-0 w-0.5 h-2 bg-white opacity-50"></div>
          <div
            className={`h-2 rounded-full transition-all duration-300 ${nuplStatus.bgColor}`}
            style={{ 
              width: `${Math.abs(currentNUPL) * 50}%`,
              marginLeft: currentNUPL >= 0 ? '50%' : `${50 + (currentNUPL * 50)}%`
            }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-400">
          <span>Capitulation (-50%)</span>
          <span>Fear (-25%)</span>
          <span>Neutral (0%)</span>
          <span>Greed (50%)</span>
          <span>Euphoria (75%)</span>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[var(--bitcoin-gray)] rounded-lg p-3 text-center">
          <div className="text-sm font-bold text-white">
            {avgNuplPercent.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-400">30-Day Avg</div>
        </div>
        <div className="bg-[var(--bitcoin-gray)] rounded-lg p-3 text-center">
          <div className="text-sm font-bold text-white">
            {Array.isArray(data) && data.length > 0 
              ? (Math.max(...data.map(d => d?.nupl || 0)) * 100).toFixed(1)
              : '0.0'
            }%
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
                  {((item?.nupl || 0) * 100).toFixed(1)}%
                </span>
                <span className={`text-xs ${getNUPLStatus(item?.nupl || 0).color}`}>
                  {getNUPLStatus(item?.nupl || 0).status}
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

      {/* NUPL Explanation */}
      <div className="mt-4 p-3 bg-[var(--bitcoin-gray)] rounded-lg">
        <p className="text-xs text-gray-400">
          <strong className="text-white">NUPL</strong> measures the difference between Unrealized Profit and Unrealized Loss. 
          Values above 0 indicate net profit, below 0 indicate net loss.
        </p>
      </div>
    </div>
  );
}; 