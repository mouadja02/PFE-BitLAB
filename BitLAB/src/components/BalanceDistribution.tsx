'use client';

import React from 'react';
import { useBalanceDistribution } from '@/hooks/useBalanceDistribution';
import { Wallet, Users, TrendingUp } from 'lucide-react';

export const BalanceDistribution: React.FC = () => {
  const { data, isLoading, error } = useBalanceDistribution();

  if (isLoading) {
    return (
      <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Wallet className="h-4 w-4 text-bitcoin-orange" />
          <h3 className="text-sm font-semibold text-white">Balance Distribution</h3>
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-gray-700 rounded mb-1"></div>
              <div className="h-1.5 bg-gray-600 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Wallet className="h-4 w-4 text-bitcoin-orange" />
          <h3 className="text-sm font-semibold text-white">Balance Distribution</h3>
        </div>
        <div className="text-center text-gray-400 text-sm">
          <p>Unable to load data</p>
        </div>
      </div>
    );
  }

  const formatBTCRange = (from: number, to: number) => {
    if (to === 0) return `> ${from} BTC`;
    if (from === 0) return `< ${to} BTC`;
    return `${from} - ${to} BTC`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M BTC`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K BTC`;
    }
    return `${volume.toFixed(2)} BTC`;
  };

  const formatAddresses = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(2)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toLocaleString();
  };

  const totalVolume = data?.balance_distribution && Array.isArray(data.balance_distribution) 
    ? data.balance_distribution.reduce((sum, item) => sum + (item?.totalVolume || 0), 0) 
    : 0;
  const totalAddresses = data?.balance_distribution && Array.isArray(data.balance_distribution) 
    ? data.balance_distribution.reduce((sum, item) => sum + (item?.addressesCount || 0), 0) 
    : 0;

  return (
    <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-4 glow-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Wallet className="h-4 w-4 text-bitcoin-orange" />
          <h3 className="text-sm font-semibold text-white">Balance Distribution</h3>
        </div>
        <div className="text-xs text-gray-400">
          {new Date(data.time * 1000).toLocaleDateString()}
        </div>
      </div>

      {/* Summary Stats - Compact */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[var(--bitcoin-gray)] rounded p-2">
          <div className="flex items-center space-x-1">
            <TrendingUp className="h-3 w-3 text-green-400" />
            <span className="text-xs text-gray-400">Volume</span>
          </div>
          <div className="text-sm font-bold text-white">
            {formatVolume(totalVolume)}
          </div>
        </div>
        <div className="bg-[var(--bitcoin-gray)] rounded p-2">
          <div className="flex items-center space-x-1">
            <Users className="h-3 w-3 text-blue-400" />
            <span className="text-xs text-gray-400">Addresses</span>
          </div>
          <div className="text-sm font-bold text-white">
            {formatAddresses(totalAddresses)}
          </div>
        </div>
      </div>

      {/* Compact Distribution - Show all ranges with scroll */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {data?.balance_distribution && Array.isArray(data.balance_distribution) ? data.balance_distribution.map((item, index) => {
          const volumePercentage = totalVolume > 0 ? (item.totalVolume / totalVolume) * 100 : 0;
          const addressPercentage = totalAddresses > 0 ? (item.addressesCount / totalAddresses) * 100 : 0;
          
          // For address visualization, use logarithmic scale to make small percentages visible
          // Find the max address percentage to normalize
          const maxAddressPercentage = totalAddresses > 0 
            ? Math.max(...data.balance_distribution.map(d => (d.addressesCount / totalAddresses) * 100))
            : 1;
          const normalizedAddressPercentage = maxAddressPercentage > 0 ? (addressPercentage / maxAddressPercentage) * 100 : 0;
          
          return (
            <div key={index} className="bg-[var(--bitcoin-gray)] rounded p-2">
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs font-medium text-white">
                  {formatBTCRange(item?.from || 0, item?.to || 0)}
                </div>
                <div className="text-xs text-gray-400">
                  Vol: {volumePercentage.toFixed(1)}% | Addr: {addressPercentage.toFixed(1)}%
                </div>
              </div>
              
              {/* Volume bar */}
              <div className="mb-1">
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span className="text-orange-400">Volume: {formatVolume(item?.totalVolume || 0)}</span>
                  <span>{volumePercentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-bitcoin-orange to-yellow-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(volumePercentage, 2)}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Address bar with normalized scale */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span className="text-blue-400">Addresses: {formatAddresses(item?.addressesCount || 0)}</span>
                  <span>{addressPercentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-400 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(normalizedAddressPercentage, 5)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="text-center text-gray-400 text-sm">
            <p>No balance distribution data available</p>
          </div>
        )}

      </div>

      {/* Compact Legend */}
      <div className="mt-2 flex justify-center space-x-4 text-xs text-gray-400">
        <div className="flex items-center space-x-1">
          <div className="w-2 h-1 bg-gradient-to-r from-bitcoin-orange to-yellow-500 rounded"></div>
          <span>Volume %</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded"></div>
          <span>Addresses (normalized)</span>
        </div>
      </div>
    </div>
  );
}; 