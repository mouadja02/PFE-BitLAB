'use client';

import React from 'react';
import { Card } from './Card';

interface GaugeChartProps {
  value: number;
  title?: string;
  min?: number;
  max?: number;
  className?: string;
}

export function GaugeChart({ value, title, min = 0, max = 100, className }: GaugeChartProps) {
  // Ensure value is within range
  const normalizedValue = Math.min(Math.max(value, min), max);
  
  // Calculate rotation angle based on value (from -90 to 90 degrees)
  const angle = ((normalizedValue - min) / (max - min) * 180) - 90;
  
  // Determine color based on value ranges
  const getColor = () => {
    if (normalizedValue <= 20) return '#FF4136'; // Extreme Fear - Red
    if (normalizedValue <= 40) return '#FF851B'; // Fear - Orange
    if (normalizedValue <= 60) return '#FFDC00'; // Neutral - Yellow
    if (normalizedValue <= 80) return '#2ECC40'; // Greed - Green
    return '#00BF78'; // Extreme Greed - Dark Green
  };
  
  // Get emoji based on value
  const getEmoji = () => {
    if (normalizedValue <= 20) return '😨'; // Extreme Fear
    if (normalizedValue <= 40) return '😟'; // Fear
    if (normalizedValue <= 60) return '😐'; // Neutral
    if (normalizedValue <= 80) return '😊'; // Greed
    return '🤑'; // Extreme Greed
  };
  
  // Get label text based on value
  const getLabel = () => {
    if (normalizedValue <= 20) return 'Extreme Fear';
    if (normalizedValue <= 40) return 'Fear';
    if (normalizedValue <= 60) return 'Neutral';
    if (normalizedValue <= 80) return 'Greed';
    return 'Extreme Greed';
  };

  return (
    <Card className={className}>
      {title && <h3 className="text-lg font-semibold mb-4 text-center text-gray-900 dark:text-white">{title}</h3>}
      
      <div className="flex flex-col items-center">
        <div className="relative w-48 h-24 mb-4">
          {/* Gauge background */}
          <div className="absolute w-full h-full bg-gray-200 dark:bg-bitcoin-gray rounded-t-full"></div>
          
          {/* Gauge fill */}
          <div 
            className="absolute w-full h-full rounded-t-full overflow-hidden"
            style={{
              background: `conic-gradient(${getColor()} ${normalizedValue}%, #e2e8f0 0%)`,
              transform: 'rotate(-90deg)',
              transformOrigin: 'center bottom'
            }}
          ></div>
          
          {/* Gauge needle */}
          <div 
            className="absolute top-full left-1/2 w-2 h-24 -ml-1 bg-gray-800 rounded-full origin-top"
            style={{ transform: `rotate(${angle}deg)` }}
          ></div>
          
          {/* Circle in the center */}
          <div className="absolute bottom-0 left-1/2 w-6 h-6 -ml-3 bg-gray-800 rounded-full"></div>
        </div>
        
        {/* Emoji face */}
        <div className="text-4xl mb-2">{getEmoji()}</div>
        
        {/* Value and label */}
        <div className="text-2xl font-bold mb-1 text-gray-900 dark:text-white">{normalizedValue}</div>
        <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">{getLabel()}</div>
      </div>
    </Card>
  );
} 