'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import Image from 'next/image'
import useSWR from 'swr'

// Import local image files
import ethIcon from './eth.png'
import xrpIcon from './xrp.png'
import solIcon from './sol.png'
import bnbIcon from './bnb.png'
import usdtIcon from './usdt.png'
import adaIcon from './ada.png'

interface FearGreedMeterProps {
  value: number;
  yesterdayValue?: number;
  lastWeekValue?: number;
}

interface CryptoPriceData {
  price: string;
  change24h: number;
  symbol: string;
  name: string;
  logo: any;
}

interface AltcoinPricesResponse {
  [symbol: string]: {
    price: string;
    rawPrice: number;
    change24h: number;
  };
}

const CRYPTO_DATA: {[key: string]: Omit<CryptoPriceData, 'price' | 'change24h'>} = {
  "ETH": {
    name: "Ethereum",
    logo: ethIcon,
    symbol: "ETH"
  },
  "XRP": {
    name: "Ripple",
    logo: xrpIcon,
    symbol: "XRP"
  },
  "SOL": {
    name: "Solana",
    logo: solIcon,
    symbol: "SOL"
  },
  "BNB": {
    name: "Binance Coin",
    logo: bnbIcon,
    symbol: "BNB"
  },
  "USDT": {
    name: "Tether",
    logo: usdtIcon,
    symbol: "USDT"
  },
  "ADA": {
    name: "Cardano",
    logo: adaIcon,
    symbol: "ADA"
  }
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function FearGreedMeter({ 
  value, 
  yesterdayValue = value, 
  lastWeekValue = value
}: FearGreedMeterProps) {
  const [animatedValue, setAnimatedValue] = React.useState(value);
  
  // Fetch altcoin prices using SWR
  const { data: altcoinPrices, isLoading: pricesLoading } = useSWR<AltcoinPricesResponse>(
    '/api/altcoin-prices',
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true, // Refresh on page focus
      dedupingInterval: 30000, // Dedupe requests within 30 seconds
    }
  );
  
  React.useEffect(() => {
    const duration = 800; // Smoother animation
    const interval = 10;
    const steps = duration / interval;
    const step = (value - animatedValue) / steps;
    
    if (Math.abs(value - animatedValue) < 0.1) {
      setAnimatedValue(value);
      return;
    }
    
    const timer = setInterval(() => {
      setAnimatedValue((prev: number) => {
        const nextValue = prev + step;
        if ((step > 0 && nextValue >= value) || (step < 0 && nextValue <= value)) {
          clearInterval(timer);
          return value;
        }
        return nextValue;
      });
    }, interval);
    
    return () => clearInterval(timer);
  }, [value, animatedValue]);
  
  const safeValue = Math.min(100, Math.max(0, animatedValue))
  const safeYesterdayValue = Math.min(100, Math.max(0, yesterdayValue))
  const safeLastWeekValue = Math.min(100, Math.max(0, lastWeekValue))
  
  const getSentiment = (val: number) => {
    if (val <= 25) return 'Extreme Fear'
    if (val <= 40) return 'Fear'
    if (val <= 60) return 'Neutral'
    if (val <= 80) return 'Greed'
    return 'Extreme Greed'
  }
  
  const getSentimentColor = (val: number) => {
    if (val <= 25) return '#FF4136' // Red
    if (val <= 40) return '#FF851B' // Orange
    if (val <= 60) return '#FFDC00' // Yellow
    if (val <= 80) return '#2ECC40' // Light Green
    return '#01FF70' // Bright Green
  }

  const position = `${safeValue}%`;

  const currentDate = new Date().toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric'
  });
  
  return (
    <Card className="h-full p-0 overflow-hidden" isGlowing>
      <div className="bg-transparent text-white p-3 px-4 flex justify-between items-center border-b border-[var(--border-color)]">
        <h3 className="font-semibold gradient-text">Crypto Fear & Greed</h3>
        <span className="text-xs opacity-60">Updated: {currentDate}</span>
      </div>
      
      <div className="flex flex-col items-center justify-center p-4 pt-6 animate-fade-in">
        <div className="w-full max-w-sm relative mb-14">
          <div className="h-16 rounded-t-full overflow-hidden flex glass-panel">
            <div className="w-1/4 bg-red-600 rounded-tl-full"></div>
            <div className="w-1/4 bg-orange-500"></div>
            <div className="w-1/4 bg-yellow-400"></div>
            <div className="w-1/4 bg-green-500 rounded-tr-full"></div>
          </div>
          
          <div className="flex justify-between w-full mt-1 px-2">
            <span className="text-xs text-gray-400">0</span>
            <span className="text-xs text-gray-400">100</span>
          </div>
          
          <div 
            className="absolute bottom-0 transform -translate-y-1/2 -translate-x-1/2 z-20 transition-all duration-800 ease-out" 
            style={{ left: `clamp(5%, ${position}, 95%)` }} // Clamp position
          >
            <div className="w-10 h-10 rounded-full bg-[var(--bitcoin-orange)] flex items-center justify-center text-white font-bold text-xl shadow-lg animate-pulse-fast hover:scale-110 transition-transform">
              ₿
            </div>
            <div className="h-5 w-[2px] bg-white absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-full"></div>
            
            <div className="absolute left-1/2 transform -translate-x-1/2 mt-3 whitespace-nowrap text-center">
              <div className="text-white font-semibold text-lg">
                Now: <span style={{ color: getSentimentColor(safeValue) }}>{Math.round(safeValue)}</span>
              </div>
              <div className="font-medium text-sm" style={{ color: getSentimentColor(safeValue) }}>
                {getSentiment(safeValue)}
              </div>
            </div>
          </div>
        </div>
        
        <div className="w-full max-w-sm p-3 glass-panel rounded-lg mt-2">
          <h4 className="text-base font-bold text-white mb-2 text-center">Market Sentiment</h4>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="transition-transform hover:scale-105">
              <p className="text-xs text-gray-400 mb-1">Now</p>
              <p className="text-sm font-semibold" style={{ color: getSentimentColor(safeValue) }}>
                {Math.round(safeValue)}<br/>{getSentiment(safeValue)}
              </p>
            </div>
            
            <div className="transition-transform hover:scale-105">
              <p className="text-xs text-gray-400 mb-1">Yesterday</p>
              <p className="text-sm font-semibold" style={{ color: getSentimentColor(safeYesterdayValue) }}>
                {safeYesterdayValue}<br/>{getSentiment(safeYesterdayValue)}
              </p>
            </div>
            
            <div className="transition-transform hover:scale-105">
              <p className="text-xs text-gray-400 mb-1">Last Week</p>
              <p className="text-sm font-semibold" style={{ color: getSentimentColor(safeLastWeekValue) }}>
                {safeLastWeekValue}<br/>{getSentiment(safeLastWeekValue)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="w-full max-w-sm mt-11">
          <h4 className="text-base font-bold text-white mb-2 text-center">Top Altcoins</h4>
          <div className="grid grid-cols-2 gap-2">
            {pricesLoading ? (
              // Loading skeleton - 6 skeletons (3x2 grid)
              Array.from({ length: 6 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="glass-panel rounded-lg p-2 animate-pulse">
                  <div className="h-5 bg-bitcoin-gray rounded w-1/3 mb-1"></div>
                  <div className="h-6 bg-bitcoin-gray rounded w-2/3 mb-1"></div>
                  <div className="h-4 bg-bitcoin-gray rounded w-1/4"></div>
                </div>
              ))
            ) : (
              // Actual crypto cards using live prices
              Object.keys(CRYPTO_DATA).map((symbol) => {
                const cryptoInfo = CRYPTO_DATA[symbol];
                const priceData = altcoinPrices?.[symbol];
                
                if (!cryptoInfo || !priceData) return null;
                
                return (
                  <div key={symbol} className="glass-panel rounded-lg p-1.5 hover:ring-1 hover:ring-bitcoin-orange transition-all duration-200 transform hover:scale-105">
                    <div className="flex items-center mb-1">
                      <div className="w-5 h-5 mr-2 rounded-full overflow-hidden bg-white p-0.5 relative">
                        <Image 
                          src={cryptoInfo.logo} 
                          alt={cryptoInfo.name} 
                          width={20}
                          height={20}
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                      <span className="text-xs text-gray-300">{cryptoInfo.symbol}</span>
                    </div>
                    <div className="text-sm font-bold text-white">{priceData.price}</div>
                    <div className={`text-xs ${priceData.change24h >= 0 ? 'text-green-400' : 'text-red-400'} flex items-center`}>
                      {priceData.change24h >= 0 ? '↑' : '↓'} {Math.abs(priceData.change24h).toFixed(2)}%
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Card>
  )
} 