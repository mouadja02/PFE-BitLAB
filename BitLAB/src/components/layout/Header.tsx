"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Bitcoin } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/' },
  { name: 'Block Explorer', href: '/block-explorer' },
  { name: 'Charts', href: '/charts' },
  { name: 'Analytics', href: '/trading' },
  { name: 'Bitcoin Concepts', href: '/learn' },
  { name: 'Trading Bot', href: '/trading-bot' },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-bitcoin-dark shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <Bitcoin className="h-8 w-8 text-bitcoin-orange" />
              <span className="ml-2 text-xl font-bold text-white">BitLAB</span>
            </Link>
            <nav className="hidden sm:ml-8 sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
                    pathname === item.href
                      ? 'border-bitcoin-orange text-white'
                      : 'border-transparent text-gray-300 hover:text-white hover:border-gray-300'
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
      
      {/* Mobile navigation */}
      <div className="sm:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'block px-3 py-2 rounded-md text-base font-medium',
                pathname === item.href
                  ? 'bg-bitcoin-gray text-white'
                  : 'text-gray-300 hover:bg-bitcoin-gray hover:text-white'
              )}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
} 