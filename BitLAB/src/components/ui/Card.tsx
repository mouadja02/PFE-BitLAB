"use client";

import React from 'react';
import clsx from 'clsx';

interface CardProps {
  title?: string;
  children?: React.ReactNode;
  className?: string;
  isHoverable?: boolean;
  isGlowing?: boolean;
}

export function Card({ 
  title, 
  children, 
  className,
  isHoverable = false,
  isGlowing = false
}: CardProps) {
  return (
    <div className={clsx(
      'dark:bg-bitcoin-dark rounded-lg shadow-md overflow-hidden glass-panel',
      isHoverable && 'card-hover-effect',
      isGlowing && 'glow-border',
      className
    )}>
      {title && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-[var(--border-color)]">
          <h3 className="font-semibold text-gray-800 dark:text-white">{title}</h3>
        </div>
      )}
      {children && <div className="p-4">{children}</div>}
    </div>
  );
}

interface CardStatProps {
  title: string;
  value: string | number;
  change?: string | number;
  isPositive?: boolean;
  icon?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  delay?: number;
  autoRefresh?: boolean;
  lastUpdate?: string | null;
  onRefresh?: () => void;
}

export function CardStat({ 
  title, 
  value, 
  change, 
  isPositive = true, 
  icon, 
  className, 
  isLoading = false,
  delay = 0,
  autoRefresh = false,
  lastUpdate = null,
  onRefresh
}: CardStatProps) {
  return (
    <div 
      className={clsx(
        'flex flex-col p-4 rounded-lg glass-panel',
        'card-hover-effect glow-border',
        'animate-slide-up-delay',
        className
      )}
      style={{ '--delay': `${delay}ms` } as React.CSSProperties}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            {autoRefresh && (
              <div className="flex items-center space-x-2">
                {lastUpdate && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {lastUpdate}
                  </span>
                )}
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-500">Live</span>
                </div>
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    className="text-xs text-bitcoin-orange hover:text-orange-400 transition-colors"
                    title="Refresh now"
                  >
                    ↻
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="mt-1 flex items-baseline">
            {isLoading ? (
              <div className="h-7 w-24 bg-[var(--bitcoin-gray)] animate-pulse-fast rounded"></div>
            ) : (
              <>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
                {change && (
                  <span className={clsx(
                    'ml-2 text-sm font-medium', 
                    isPositive ? 'text-green-500' : 'text-red-500'
                  )}>
                    {isPositive ? '+' : ''}{change}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {icon && (
          <div className={clsx(
            "p-2 rounded-full transition-transform duration-300",
            "bg-[var(--bitcoin-gray)] text-[var(--bitcoin-orange)]",
            "hover:scale-110",
            "ml-3"
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
} 