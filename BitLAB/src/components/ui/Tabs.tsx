"use client";

import React from 'react';
import clsx from 'clsx';

interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
  onValueChange?: (value: string) => void;
}

export function Tabs({ defaultValue, children, className }: TabsProps) {
  return (
    <div className={clsx('w-full', className)}>
      {children}
    </div>
  );
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div className={clsx(
      'flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4',
      className
    )}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function TabsTrigger({ value, children, className, disabled = false }: TabsTriggerProps) {
  // In a real implementation, this would be connected to React state
  // and would trigger tab changes
  return (
    <button
      type="button"
      role="tab"
      data-value={value}
      disabled={disabled}
      className={clsx(
        'flex-1 py-2 px-3 text-sm font-medium rounded-md text-center',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:ring-opacity-50',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white',
        className
      )}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  return (
    <div
      role="tabpanel"
      data-value={value}
      className={clsx('outline-none', className)}
    >
      {children}
    </div>
  );
} 