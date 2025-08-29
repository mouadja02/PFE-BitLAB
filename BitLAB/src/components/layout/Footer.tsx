"use client";

import React from 'react';
import Link from 'next/link';
import { Bitcoin } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-bitcoin-dark">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex justify-center md:justify-start">
            <Link href="/" className="flex items-center">
              <Bitcoin className="h-6 w-6 text-bitcoin-orange" />
              <span className="ml-2 text-lg font-semibold text-white">BitLAB</span>
            </Link>
          </div>
          <div className="mt-8 md:mt-0">
            <p className="text-center text-sm text-gray-400">
              &copy; {currentYear} BitLAB. All rights reserved.
            </p>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-700 pt-8">
          <p className="text-center text-xs text-gray-400">
            BitLAB is a personal project. Bitcoin data is provided for informational purposes only. Not financial advice!
          </p>
        </div>
      </div>
    </footer>
  );
} 