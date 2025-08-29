import React from 'react';
import { Card } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { BalanceDistribution } from '@/components/BalanceDistribution';

interface TradingSignalData {
  category: string;
  sentiment: string;
  value: number;
  score: number;
  score_threshold_bearish: number;
  score_threshold_bullish: number;
}

interface TradingSignalsProps {
  data: {
    timestamp: number;
    signals: {
      inOutVar: TradingSignalData;
      addressesNetGrowth: TradingSignalData;
      concentrationVar: TradingSignalData;
      largetxsVar: TradingSignalData;
    };
  } | null;
  isLoading: boolean;
}

const getSentimentIcon = (sentiment: string) => {
  switch (sentiment.toLowerCase()) {
    case 'bullish':
      return <TrendingUp className="h-4 w-4 text-green-400" />;
    case 'bearish':
      return <TrendingDown className="h-4 w-4 text-red-400" />;
    default:
      return <Minus className="h-4 w-4 text-yellow-400" />;
  }
};

const getSentimentColor = (sentiment: string) => {
  switch (sentiment.toLowerCase()) {
    case 'bullish':
      return 'text-green-400';
    case 'bearish':
      return 'text-red-400';
    default:
      return 'text-yellow-400';
  }
};

const getSignalName = (key: string) => {
  switch (key) {
    case 'inOutVar':
      return 'In/Out Variation';
    case 'addressesNetGrowth':
      return 'Address Growth';
    case 'concentrationVar':
      return 'Concentration';
    case 'largetxsVar':
      return 'Large Transactions';
    default:
      return key;
  }
};

export function TradingSignals({ data, isLoading }: TradingSignalsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="glass-panel glow-border">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <Activity className="h-5 w-5 text-bitcoin-orange mr-2" />
              <h3 className="text-lg font-semibold text-white">Trading Signals</h3>
            </div>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="h-4 bg-bitcoin-gray rounded mb-2 w-3/4"></div>
                  <div className="h-3 bg-bitcoin-gray rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        
        {/* Balance Distribution Component */}
        <BalanceDistribution />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Card className="glass-panel glow-border">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <Activity className="h-5 w-5 text-bitcoin-orange mr-2" />
              <h3 className="text-lg font-semibold text-white">Trading Signals</h3>
            </div>
            <div className="text-center text-gray-400">
              <p>Unable to load trading signals</p>
            </div>
          </div>
        </Card>
        
        {/* Balance Distribution Component */}
        <BalanceDistribution />
      </div>
    );
  }

  const signals = Object.entries(data.signals);

  return (
    <div className="space-y-6">
      <Card className="glass-panel glow-border">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Activity className="h-5 w-5 text-bitcoin-orange mr-2" />
              <h3 className="text-lg font-semibold text-white">Trading Signals</h3>
            </div>
            <div className="text-xs text-gray-400">
              {new Date(data.timestamp * 1000).toLocaleTimeString()}
            </div>
          </div>
          
          <div className="space-y-4">
            {signals.map(([key, signal]) => (
              <div key={key} className="border-b border-gray-700 pb-3 last:border-b-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center">
                    {getSentimentIcon(signal.sentiment)}
                    <span className="text-sm font-medium text-white ml-2">
                      {getSignalName(key)}
                    </span>
                  </div>
                  <span className={`text-xs font-bold uppercase ${getSentimentColor(signal.sentiment)}`}>
                    {signal.sentiment}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <span>Score: {(signal.score * 100).toFixed(1)}%</span>
                  <span>Value: {(signal.value * 100).toFixed(3)}%</span>
                </div>
                
                {/* Score bar */}
                <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      signal.sentiment === 'bullish' ? 'bg-green-400' :
                      signal.sentiment === 'bearish' ? 'bg-red-400' : 'bg-yellow-400'
                    }`}
                    style={{ width: `${Math.max(signal.score * 100, 5)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-400 text-center">
              <span>Powered by </span>
              <a 
                href="https://developers.coindesk.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-bitcoin-orange hover:underline"
              >
                CoinDesk
              </a>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Balance Distribution Component */}
      <BalanceDistribution />
    </div>
  );
} 