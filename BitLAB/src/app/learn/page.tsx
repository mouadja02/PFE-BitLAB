"use client";

import React from 'react';
import { Card } from '@/components/ui/Card';
import { 
  Bitcoin, 
  Database, 
  Key, 
  Link as LinkIcon, 
  Shield, 
  Cpu, 
  BookOpen,
  Wallet,
  Lock,
  Unlock,
  Newspaper,
  ExternalLink,
  Calendar,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// Define NewsItem interface for better type checking
interface NewsItem {
  id: number;
  category: string;
  datetime: number;
  headline: string;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

const ConceptCard = ({ 
  title, 
  icon, 
  children, 
  color = "blue" 
}: { 
  title: string; 
  icon: React.ReactNode; 
  children: React.ReactNode;
  color?: "blue" | "green" | "purple" | "orange" | "red";
}) => {
  const colorClasses = {
    blue: "bg-blue-900/20 border-blue-500/40 hover:border-blue-500/80",
    green: "bg-green-900/20 border-green-500/40 hover:border-green-500/80",
    purple: "bg-purple-900/20 border-purple-500/40 hover:border-purple-500/80",
    orange: "bg-orange-900/20 border-orange-500/40 hover:border-orange-500/80",
    red: "bg-red-900/20 border-red-500/40 hover:border-red-500/80",
  }

  return (
    <div className={`rounded-lg p-6 border ${colorClasses[color]} transition-all duration-300 card-hover-effect`}>
      <div className="flex items-center mb-4">
        <div className={`p-2 rounded-lg mr-3 ${color === "orange" ? "bg-orange-900 text-orange-300" : 
                                               color === "blue" ? "bg-blue-900 text-blue-300" : 
                                               color === "green" ? "bg-green-900 text-green-300" :
                                               color === "purple" ? "bg-purple-900 text-purple-300" :
                                               "bg-red-900 text-red-300"}`}>
          {icon}
        </div>
        <h3 className="text-xl font-semibold text-white">{title}</h3>
      </div>
      <div className="text-gray-300">
        {children}
      </div>
    </div>
  );
};

// Sample news data as fallback if API fails
const sampleNewsData: NewsItem[] = [
  {
    id: 7472474,
    category: "crypto",
    headline: "Bitcoin Mining Profitability Down 7.4% in March as Prices, Transaction Fees Fell: Jefferies",
    summary: "Bitcoin mining profitability decreased 7.4% in March as the cryptocurrency's price and transaction fees declined, according to Jefferies. BTC miners saw their revenue per petahash fall from $80.37 in February to $74.41 in March.",
    image: "https://cdn.sanity.io/images/s3y3vcno/production/e7982f2cd16aaa896fdd1b231cf766d18f1f1cc2-1440x1080.jpg",
    related: "BTC-USD",
    source: "CoinDesk",
    datetime: 1744640880,
    url: "https://www.coindesk.com/business/2025/04/14/bitcoin-mining-profitability-down-7-4-in-march-as-prices-transaction-fees-fell-jefferies"
  },
  {
    id: 7472475,
    category: "crypto",
    headline: "Bitcoin halving won't cut rally short, says analyst as BTC price sits at $65K",
    summary: "Bitcoin (BTC) is holding steady at $65,000 as the market prepares for the upcoming Bitcoin halving. Despite concerns that the halving might trigger a significant price drop, some analysts remain optimistic.",
    image: "https://static2.finnhub.io/file/publicdatany/hmpimage/cointelegraph.webp",
    related: "BTC-USD",
    source: "Cointelegraph",
    datetime: 1744639080,
    url: "https://cointelegraph.com/news/bitcoin-halving-won-t-cut-rally-short-says-analyst"
  },
  {
    id: 7472476,
    category: "crypto",
    headline: "Bitcoin's Third Halving Begins Today: What You Need to Know",
    summary: "The Bitcoin network will undergo its third halving event today, reducing mining rewards from 6.25 BTC to 3.125 BTC per block. This programmed reduction in supply issuance occurs approximately every four years.",
    image: "https://cdn.sanity.io/images/s3y3vcno/production/d11d05d47c057f441be1f4cb1f5284bf3ccb87c9-1920x1080.jpg",
    related: "BTC-USD",
    source: "CoinDesk",
    datetime: 1744638180,
    url: "https://www.coindesk.com/tech/2025/04/14/bitcoins-third-halving-begins-today-what-you-need-to-know"
  }
];

// Format date function for news items
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export default function BitcoinConcepts() {
  const [activeTab, setActiveTab] = React.useState('bitcoin-flow');
  const [bitcoinNews, setBitcoinNews] = React.useState<NewsItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Fetch Bitcoin news when component mounts
  React.useEffect(() => {
    fetchNews();
  }, []);

  // Function to fetch news data from Finnhub API
  const fetchNews = async () => {
    try {
      // Fetch news from Finnhub API
      const response = await fetch('https://finnhub.io/api/v1/news?category=crypto&token=cvui091r01qjg139vrv0cvui091r01qjg139vrvg');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch news: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Filter for Bitcoin-related news items only
      const bitcoinNewsItems = data.filter((item: NewsItem) => 
        item.headline.toLowerCase().includes('bitcoin') || 
        item.headline.toLowerCase().includes('btc') ||
        item.summary.toLowerCase().includes('bitcoin') ||
        item.summary.toLowerCase().includes('btc')
      );
      
      // Get all Bitcoin news items, but we'll only display 3 in the top bar
      // and more in the dedicated news tab
      setBitcoinNews(bitcoinNewsItems);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching news:', error);
      // Use sample data as fallback
      setBitcoinNews(sampleNewsData);
      setLoading(false);
    }
  };

  const conceptTabs = [
    { id: 'bitcoin-flow', label: 'Bitcoin Flow', icon: <Bitcoin className="h-5 w-5" /> },
    { id: 'blockchain', label: 'Blockchain', icon: <Database className="h-5 w-5" /> },
    { id: 'transactions', label: 'Transactions', icon: <LinkIcon className="h-5 w-5" /> },
    { id: 'mining', label: 'Mining', icon: <Cpu className="h-5 w-5" /> },
    { id: 'utxo', label: 'UTXO Model', icon: <Bitcoin className="h-5 w-5" /> },
    { id: 'keys', label: 'Keys & Security', icon: <Key className="h-5 w-5" /> },
    { id: 'wallet', label: 'Wallets', icon: <Wallet className="h-5 w-5" /> },
  ];

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-white gradient-text mb-3 animate-slide-up">
          Bitcoin Concepts
        </h1>
        <p className="text-lg text-gray-300 animate-slide-up-delay" style={{ '--delay': '100ms' } as React.CSSProperties}>
          Visual explanations of how blockchain technology powers Bitcoin
        </p>
      </div>


      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-800 pb-2">
        {conceptTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-4 py-2 rounded-t-lg transition-all ${
              activeTab === tab.id
                ? 'bg-bitcoin-gray text-white border-b-2 border-bitcoin-orange'
                : 'text-gray-400 hover:text-white hover:bg-bitcoin-gray/50'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="mt-8">
        {activeTab === 'bitcoin-flow' && (
          <div className="space-y-8 animate-fade-in">
            <Card className="mb-8" isGlowing>
              <h2 className="text-2xl font-bold mb-6 gradient-text text-center">The Complete Bitcoin Transaction Lifecycle</h2>
              
              <div className="flex flex-col items-center mb-8">
                <p className="text-lg text-center max-w-3xl mb-6">
                  Bitcoin works as an integrated system where transactions flow through multiple stages, secured by cryptography, 
                  verified by nodes, and permanently recorded on the blockchain.
                </p>
                
                {/* Horizontal Timeline Steps */}
                <div className="w-full max-w-5xl overflow-x-auto px-4">
                  <div className="flex justify-between min-w-[900px] relative mb-8">
                    {/* Connection Line */}
                    <div className="absolute top-8 left-12 right-12 h-1 bg-bitcoin-orange z-0"></div>
                    
                    {/* Step 1: Wallet & Keys */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="h-16 w-16 rounded-full bg-bitcoin-dark border-2 border-bitcoin-orange flex items-center justify-center mb-2">
                        <Key className="h-8 w-8 text-bitcoin-orange" />
                      </div>
                      <div className="text-xs font-semibold text-gray-400">STEP 1</div>
                      <div className="font-semibold">Keys & Wallet</div>
                    </div>
                    
                    {/* Step 2: UTXO Selection */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="h-16 w-16 rounded-full bg-bitcoin-dark border-2 border-bitcoin-orange flex items-center justify-center mb-2">
                        <Wallet className="h-8 w-8 text-bitcoin-orange" />
                      </div>
                      <div className="text-xs font-semibold text-gray-400">STEP 2</div>
                      <div className="font-semibold">UTXO Selection</div>
                    </div>
                    
                    {/* Step 3: Transaction Signing */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="h-16 w-16 rounded-full bg-bitcoin-dark border-2 border-bitcoin-orange flex items-center justify-center mb-2">
                        <Lock className="h-8 w-8 text-bitcoin-orange" />
                      </div>
                      <div className="text-xs font-semibold text-gray-400">STEP 3</div>
                      <div className="font-semibold">Transaction Signing</div>
                    </div>
                    
                    {/* Step 4: Mempool */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="h-16 w-16 rounded-full bg-bitcoin-dark border-2 border-bitcoin-orange flex items-center justify-center mb-2">
                        <LinkIcon className="h-8 w-8 text-bitcoin-orange" />
                      </div>
                      <div className="text-xs font-semibold text-gray-400">STEP 4</div>
                      <div className="font-semibold">Mempool</div>
                    </div>
                    
                    {/* Step 5: Block Creation */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="h-16 w-16 rounded-full bg-bitcoin-dark border-2 border-bitcoin-orange flex items-center justify-center mb-2">
                        <Database className="h-8 w-8 text-bitcoin-orange" />
                      </div>
                      <div className="text-xs font-semibold text-gray-400">STEP 5</div>
                      <div className="font-semibold">Block Creation</div>
                    </div>
                    
                    {/* Step 6: Mining */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="h-16 w-16 rounded-full bg-bitcoin-dark border-2 border-bitcoin-orange flex items-center justify-center mb-2">
                        <Cpu className="h-8 w-8 text-bitcoin-orange" />
                      </div>
                      <div className="text-xs font-semibold text-gray-400">STEP 6</div>
                      <div className="font-semibold">Mining</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Detailed Flow Section */}
              <div className="space-y-12 mt-6">
                {/* Step 1: Wallet & Keys */}
                <div className="glass-panel border border-[var(--border-color)] rounded-lg p-6" id="step1">
                  <div className="flex items-center mb-4">
                    <div className="h-10 w-10 rounded-full bg-bitcoin-dark border-2 border-bitcoin-orange flex items-center justify-center mr-4">
                      <div className="text-bitcoin-orange font-bold">1</div>
                    </div>
                    <h3 className="text-xl font-semibold gradient-text">Keys & Wallet</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <p className="mb-4">
                        The Bitcoin journey begins with cryptographic keys. Your wallet generates and stores these keys
                        which provide security and ownership of your funds:
                      </p>
                      <ul className="list-disc pl-5 mb-4 space-y-2">
                        <li><strong className="text-bitcoin-orange">Private key</strong>: Secret key only you possess</li>
                        <li><strong className="text-bitcoin-orange">Public key</strong>: Derived from private key</li>
                        <li><strong className="text-bitcoin-orange">Bitcoin address</strong>: Derived from public key</li>
                      </ul>
                      <p>
                        You share your Bitcoin address to receive funds. These funds are stored as Unspent Transaction Outputs (UTXOs)
                        associated with your address on the blockchain.
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <div className="glass-panel border border-gray-700 p-4 rounded-lg">
                        <div className="flex flex-col space-y-4">
                          <div className="bg-gray-800 p-3 rounded-lg relative">
                            <div className="absolute -top-3 left-4 bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center">
                              <Lock className="h-3 w-3 mr-1" />
                              Private Key (Secret)
                            </div>
                            <div className="mt-2">
                              <div className="text-xs font-mono bg-gray-900 p-2 rounded truncate">
                                5KJvsngHeMpm884wtkJNzQGaCErckhHJ...
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex justify-center">
                            <div className="h-8 w-1 bg-bitcoin-orange"></div>
                          </div>
                          
                          <div className="bg-gray-800 p-3 rounded-lg relative">
                            <div className="absolute -top-3 left-4 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                              Bitcoin Address (Public)
                            </div>
                            <div className="mt-2">
                              <div className="text-xs font-mono bg-gray-900 p-2 rounded truncate">
                                1PMycacnJaSqwwJqjawXBErnLsZ7RkXUAs
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Step 2: UTXO Selection */}
                <div className="glass-panel border border-[var(--border-color)] rounded-lg p-6" id="step2">
                  <div className="flex items-center mb-4">
                    <div className="h-10 w-10 rounded-full bg-bitcoin-dark border-2 border-bitcoin-orange flex items-center justify-center mr-4">
                      <div className="text-bitcoin-orange font-bold">2</div>
                    </div>
                    <h3 className="text-xl font-semibold gradient-text">UTXO Selection</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <p className="mb-4">
                        When you initiate a Bitcoin transaction, your wallet must select which UTXOs to spend:
                      </p>
                      <ul className="list-disc pl-5 mb-4 space-y-2">
                        <li>Your wallet balance is the sum of all your UTXOs</li>
                        <li>Each UTXO must be spent entirely in a transaction</li>
                        <li>If you're sending less than the UTXO amount, the remainder comes back as "change"</li>
                        <li>The wallet selects UTXOs based on various strategies (minimize fees, privacy, etc.)</li>
                      </ul>
                      <p>
                        These UTXOs are essentially references to previous transaction outputs that you control
                        and can spend with your private key.
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <div className="glass-panel border border-gray-700 p-4 rounded-lg">
                        <div className="text-center mb-4 text-sm">Selecting UTXOs for a New Transaction</div>
                        <div className="space-y-4">
                          <div className="bg-gray-800 p-3 rounded-lg">
                            <div className="text-xs mb-2">Available UTXOs in Wallet</div>
                            <div className="space-y-2">
                              <div className="flex justify-between bg-gray-900 p-2 rounded border-l-4 border-bitcoin-orange">
                                <span className="text-xs font-mono">UTXO #1</span>
                                <span className="text-xs font-mono">0.5 BTC</span>
                              </div>
                              <div className="flex justify-between bg-gray-900 p-2 rounded">
                                <span className="text-xs font-mono">UTXO #2</span>
                                <span className="text-xs font-mono">1.2 BTC</span>
                              </div>
                              <div className="flex justify-between bg-gray-900 p-2 rounded border-l-4 border-bitcoin-orange">
                                <span className="text-xs font-mono">UTXO #3</span>
                                <span className="text-xs font-mono">0.8 BTC</span>
                              </div>
                            </div>
                            <div className="text-right text-xs mt-2">
                              Total Selected: 1.3 BTC
                            </div>
                          </div>
                          
                          <div className="flex justify-center">
                            <div className="flex flex-col items-center">
                              <div className="text-xs mb-1">Send 1.0 BTC</div>
                              <div className="h-8 w-1 bg-bitcoin-orange"></div>
                            </div>
                          </div>
                          
                          <div className="bg-gray-800 p-3 rounded-lg">
                            <div className="text-xs mb-2">New Transaction Outputs</div>
                            <div className="space-y-2">
                              <div className="flex justify-between bg-gray-900 p-2 rounded border-l-4 border-green-500">
                                <span className="text-xs font-mono">To: Recipient</span>
                                <span className="text-xs font-mono">1.0 BTC</span>
                              </div>
                              <div className="flex justify-between bg-gray-900 p-2 rounded border-l-4 border-blue-500">
                                <span className="text-xs font-mono">Change to Self</span>
                                <span className="text-xs font-mono">0.29 BTC</span>
                              </div>
                            </div>
                            <div className="text-right text-xs mt-2">
                              Fee: 0.01 BTC
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Step 3: Transaction Signing */}
                <div className="glass-panel border border-[var(--border-color)] rounded-lg p-6" id="step3">
                  <div className="flex items-center mb-4">
                    <div className="h-10 w-10 rounded-full bg-bitcoin-dark border-2 border-bitcoin-orange flex items-center justify-center mr-4">
                      <div className="text-bitcoin-orange font-bold">3</div>
                    </div>
                    <h3 className="text-xl font-semibold gradient-text">Transaction Signing</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <p className="mb-4">
                        Once UTXOs are selected, your wallet constructs the transaction and signs it with your private key:
                      </p>
                      <ul className="list-disc pl-5 mb-4 space-y-2">
                        <li>The transaction specifies inputs (UTXOs being spent) and outputs (recipients)</li>
                        <li>Your private key creates a cryptographic signature that proves ownership</li>
                        <li>This signature is unique to the transaction details, preventing tampering</li>
                        <li>The signature proves you control the UTXOs without revealing your private key</li>
                      </ul>
                      <p>
                        The signed transaction is ready to be broadcasted to the Bitcoin network.
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <div className="glass-panel border border-gray-700 p-4 rounded-lg">
                        <div className="text-center mb-4 text-sm">Transaction Signing Process</div>
                        <div className="space-y-4">
                          <div className="bg-gray-800 p-3 rounded-lg">
                            <div className="text-xs mb-2">Unsigned Transaction</div>
                            <div className="text-xs font-mono bg-gray-900 p-2 rounded">
                              {`{
  "inputs": [
    {"txid": "a59c...", "vout": 0, "amount": 0.5},
    {"txid": "f82d...", "vout": 1, "amount": 0.8}
  ],
  "outputs": [
    {"address": "bc1q...", "amount": 1.0},
    {"address": "3Fxz...", "amount": 0.29}
  ]
}`}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-center">
                            <div className="bg-gray-800 p-2 rounded-full flex items-center">
                              <Lock className="h-5 w-5 text-red-400 mr-2" />
                              <span className="text-xs">Private Key Signs</span>
                            </div>
                          </div>
                          
                          <div className="bg-gray-800 p-3 rounded-lg">
                            <div className="text-xs mb-2">Signed Transaction</div>
                            <div className="text-xs font-mono bg-gray-900 p-2 rounded">
                              {`{
  "inputs": [
    {"txid": "a59c...", "vout": 0, "amount": 0.5,
     "signature": "304402..."},
    {"txid": "f82d...", "vout": 1, "amount": 0.8,
     "signature": "304402..."}
  ],
  "outputs": [
    {"address": "bc1q...", "amount": 1.0},
    {"address": "3Fxz...", "amount": 0.29}
  ]
}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Step 4: Mempool */}
                <div className="glass-panel border border-[var(--border-color)] rounded-lg p-6" id="step4">
                  <div className="flex items-center mb-4">
                    <div className="h-10 w-10 rounded-full bg-bitcoin-dark border-2 border-bitcoin-orange flex items-center justify-center mr-4">
                      <div className="text-bitcoin-orange font-bold">4</div>
                    </div>
                    <h3 className="text-xl font-semibold gradient-text">Mempool</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <p className="mb-4">
                        After signing, the transaction is broadcasted to the Bitcoin network and enters the mempool (memory pool):
                      </p>
                      <ul className="list-disc pl-5 mb-4 space-y-2">
                        <li>The mempool is a waiting area for unconfirmed transactions</li>
                        <li>Each node maintains its own mempool of pending transactions</li>
                        <li>Nodes validate incoming transactions before adding them to their mempool</li>
                        <li>Transactions with higher fees are prioritized by miners for inclusion in blocks</li>
                      </ul>
                      <p>
                        The transaction remains in the mempool until a miner selects it for inclusion in a block.
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <div className="glass-panel border border-gray-700 p-4 rounded-lg">
                        <div className="text-center mb-4 text-sm">Mempool Visualization</div>
                        <div className="space-y-4">
                          <div className="bg-gray-800 p-3 rounded-lg">
                            <div className="flex justify-between mb-2">
                              <span className="text-xs">Unconfirmed Transactions</span>
                              <span className="text-xs">Fee (sat/vB)</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between bg-green-900/20 p-2 rounded">
                                <span className="text-xs font-mono truncate w-32">tx_43ef...</span>
                                <span className="text-xs font-mono">121</span>
                              </div>
                              <div className="flex justify-between bg-yellow-900/20 p-2 rounded">
                                <span className="text-xs font-mono truncate w-32">tx_a92c...</span>
                                <span className="text-xs font-mono">85</span>
                              </div>
                              <div className="flex justify-between bg-bitcoin-orange/20 border border-bitcoin-orange p-2 rounded">
                                <span className="text-xs font-mono truncate w-32">tx_f721... (Yours)</span>
                                <span className="text-xs font-mono">63</span>
                              </div>
                              <div className="flex justify-between bg-gray-900 p-2 rounded">
                                <span className="text-xs font-mono truncate w-32">tx_b33d...</span>
                                <span className="text-xs font-mono">42</span>
                              </div>
                              <div className="flex justify-between bg-gray-900 p-2 rounded">
                                <span className="text-xs font-mono truncate w-32">tx_c6ab...</span>
                                <span className="text-xs font-mono">15</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-xs text-center">
                            Miners prioritize transactions with higher fees
                          </div>
                          
                          <div className="flex items-center justify-center">
                            <div className="px-4 py-1 bg-bitcoin-orange rounded-full">
                              <span className="text-xs text-black font-semibold">Waiting for inclusion in a block</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Step 5: Block Creation */}
                <div className="glass-panel border border-[var(--border-color)] rounded-lg p-6" id="step5">
                  <div className="flex items-center mb-4">
                    <div className="h-10 w-10 rounded-full bg-bitcoin-dark border-2 border-bitcoin-orange flex items-center justify-center mr-4">
                      <div className="text-bitcoin-orange font-bold">5</div>
                    </div>
                    <h3 className="text-xl font-semibold gradient-text">Block Creation & Merkle Root</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <p className="mb-4">
                        Miners collect transactions from the mempool to create candidate blocks:
                      </p>
                      <ul className="list-disc pl-5 mb-4 space-y-2">
                        <li>The block contains a header and a list of transactions</li>
                        <li>All transaction IDs are hashed together in a Merkle Tree structure</li>
                        <li>The top hash (Merkle Root) represents all transactions in the block</li>
                        <li>The Merkle Root is included in the block header, making blocks efficient to verify</li>
                        <li>Any change to any transaction would change the Merkle Root</li>
                      </ul>
                      <p>
                        The Merkle Root provides an efficient way to verify that a transaction is included in a block
                        without needing to download all transactions.
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <div className="glass-panel border border-gray-700 p-4 rounded-lg">
                        <div className="text-center mb-4 text-sm">Merkle Tree Structure</div>
                        <div className="flex flex-col items-center">
                          {/* Merkle Root */}
                          <div className="bg-bitcoin-orange text-black px-3 py-1 rounded text-xs mb-4 font-mono">
                            Merkle Root: d5b4...
                          </div>
                          
                          {/* Level 1 - 2 hashes */}
                          <div className="flex space-x-12 mb-4">
                            <div className="bg-gray-800 px-3 py-1 rounded text-xs font-mono">
                              Hash A+B: c7d2...
                            </div>
                            <div className="bg-gray-800 px-3 py-1 rounded text-xs font-mono">
                              Hash C+D: f3a1...
                            </div>
                          </div>
                          
                          {/* Connection Lines Level 1 to Root */}
                          <div className="relative w-full h-6 mb-4">
                            <div className="absolute left-1/4 top-0 w-1 h-3 bg-bitcoin-orange -translate-x-1/2"></div>
                            <div className="absolute right-1/4 top-0 w-1 h-3 bg-bitcoin-orange translate-x-1/2"></div>
                            <div className="absolute left-1/2 top-3 w-1/2 h-1 bg-bitcoin-orange -translate-x-1/2"></div>
                          </div>
                          
                          {/* Level 2 - 4 Tx Hashes */}
                          <div className="grid grid-cols-4 gap-4 mb-4">
                            <div className="bg-gray-800 px-3 py-1 rounded text-xs font-mono">
                              Tx A: e2f8...
                            </div>
                            <div className="bg-gray-800 px-3 py-1 rounded text-xs font-mono">
                              Tx B: a7c9...
                            </div>
                            <div className="bg-bitcoin-orange/20 border border-bitcoin-orange px-3 py-1 rounded text-xs font-mono">
                              Tx C: f721... (Yours)
                            </div>
                            <div className="bg-gray-800 px-3 py-1 rounded text-xs font-mono">
                              Tx D: b33d...
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-400 text-center mt-2 px-4">
                            The Merkle Root in the block header represents all transactions, enabling efficient verification
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Step 6: Mining */}
                <div className="glass-panel border border-[var(--border-color)] rounded-lg p-6" id="step6">
                  <div className="flex items-center mb-4">
                    <div className="h-10 w-10 rounded-full bg-bitcoin-dark border-2 border-bitcoin-orange flex items-center justify-center mr-4">
                      <div className="text-bitcoin-orange font-bold">6</div>
                    </div>
                    <h3 className="text-xl font-semibold gradient-text">Mining & Blockchain Confirmation</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <p className="mb-4">
                        With the block created, miners compete to find a valid hash that meets the network's difficulty requirement:
                      </p>
                        <ul className="list-disc pl-5 mb-4 space-y-2">
                          <li>The block header includes:
                            <ul className="list-disc pl-5 mt-2">
                              <li>Previous block hash (creating the chain)</li>
                              <li>Merkle Root (representing all transactions)</li>
                              <li>Timestamp</li>
                              <li>Difficulty target</li>
                              <li>Nonce (value miners change to find valid hash)</li>
                            </ul>
                          </li>
                          <li>Miners repeatedly hash the block header with different nonce values</li>
                          <li>When a valid hash is found, the block is broadcast to the network</li>
                          <li>Other nodes verify the block and add it to their copy of the blockchain</li>
                          <li>Once several blocks are built on top, your transaction is considered confirmed</li>
                        </ul>
                    </div>
                    <div className="flex justify-center">
                      <div className="glass-panel border border-gray-700 p-4 rounded-lg">
                        <div className="text-center mb-4 text-sm">Mining Process & Blockchain</div>
                        <div className="space-y-4">
                          <div className="bg-gray-800 p-3 rounded-lg">
                            <div className="text-xs mb-2">Block Header</div>
                            <div className="text-xs font-mono bg-gray-900 p-2 rounded">
                              {`{
  "version": 1,
  "prevBlockHash": "00000000a7c...",
  "merkleRoot": "d5b4...",
  "timestamp": 1713124800,
  "difficulty": 21434395.3,
  "nonce": 2701593
}`}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-center space-x-2">
                            <div className="h-1 w-16 bg-bitcoin-orange"></div>
                            <div className="bg-gray-800 p-2 rounded-full">
                              <span className="text-xs">SHA-256 Hash</span>
                            </div>
                            <div className="h-1 w-16 bg-bitcoin-orange"></div>
                          </div>
                          
                          <div className="bg-green-900/20 border border-green-500 p-3 rounded-lg">
                            <div className="text-xs mb-2">Valid Block Hash</div>
                            <div className="text-xs font-mono bg-gray-900 p-2 rounded">
                              000000000000000000042a7d62dae4659914fb73ed1a41833551b0c589c8f098
                            </div>
                            <div className="text-xs text-green-500 mt-2">Meets difficulty requirement (starts with enough zeros)</div>
                          </div>
                          
                          <div className="flex flex-col items-center mt-4">
                            <div className="text-xs mb-4">Block Added to Blockchain</div>
                            <div className="flex items-center space-x-2">
                              <div className="glass-panel border border-gray-700 p-2 rounded-lg w-16 h-16 flex items-center justify-center">
                                <span className="text-xs font-mono">Block<br/>762916</span>
                              </div>
                              <div className="h-1 w-6 bg-bitcoin-orange"></div>
                              <div className="glass-panel border border-gray-700 p-2 rounded-lg w-16 h-16 flex items-center justify-center">
                                <span className="text-xs font-mono">Block<br/>762917</span>
                              </div>
                              <div className="h-1 w-6 bg-bitcoin-orange"></div>
                              <div className="glass-panel border border-green-500 p-2 rounded-lg w-16 h-16 flex items-center justify-center">
                                <span className="text-xs font-mono">Block<br/>762918</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Final Transaction Confirmation */}
                <div className="bg-bitcoin-orange/10 border border-bitcoin-orange rounded-lg p-6 text-center">
                  <h3 className="text-xl font-semibold gradient-text mb-4">Transaction Lifecycle Complete</h3>
                  <p>
                    Your transaction is now permanently recorded on the Bitcoin blockchain. The new UTXOs are available
                    for the recipient to spend, and the cycle can begin again with another transaction.
                  </p>
                  <div className="mt-6">
                    <div className="inline-flex items-center px-4 py-2 border border-bitcoin-orange text-bitcoin-orange rounded-full">
                      <Shield className="h-5 w-5 mr-2" />
                      <span>Secured by cryptography, consensus, and proof-of-work</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'blockchain' && (
          <div className="space-y-8 animate-fade-in">
            <Card className="mb-8" isGlowing>
              <h2 className="text-2xl font-bold mb-4 gradient-text">The Blockchain Structure</h2>
              
              <div className="flex flex-col lg:flex-row gap-8 mb-8">
                <div className="lg:w-1/2">
                  <p className="mb-4">
                    A blockchain is a chain of blocks that contains information. The data which is stored inside a block depends on the type of blockchain. 
                    The Bitcoin blockchain stores transaction data about who sent bitcoins to whom, when, and in what amount.
                  </p>
                  <p className="mb-4">
                    Each block contains:
                  </p>
                  <ul className="list-disc pl-5 mb-4 space-y-2">
                    <li>A <strong className="text-bitcoin-orange">reference to the previous block</strong> (creating the chain)</li>
                    <li>A <strong className="text-bitcoin-orange">timestamp</strong> showing when the block was created</li>
                    <li>The <strong className="text-bitcoin-orange">transaction data</strong></li>
                    <li>A <strong className="text-bitcoin-orange">nonce</strong> (number used once) for mining</li>
                    <li>The <strong className="text-bitcoin-orange">hash</strong> of all this information</li>
                  </ul>
                </div>
                <div className="lg:w-1/2 flex justify-center">
                  <div className="w-full max-w-md">
                    <div className="relative w-full">
                      {/* Visual blockchain representation */}
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center mb-4">
                          <div className={`w-full glass-panel border border-gray-700 p-4 rounded-lg ${i === 0 ? 'border-bitcoin-orange glow-border' : ''}`}>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-mono bg-gray-800 rounded px-2 py-1">Block #{762918 - i}</span>
                              <span className="text-xs text-gray-400">2 min ago</span>
                            </div>
                            <div className="text-xs text-gray-400 font-mono mb-2 truncate">
                              Hash: 00000000a2b...
                            </div>
                            <div className="text-xs text-gray-400 font-mono mb-2 truncate">
                              Prev: {i > 0 ? '00000000b3c...' : 'N/A'}
                            </div>
                            <div className="bg-gray-800 h-3 w-3/4 rounded-full"></div>
                          </div>
                          {i < 3 && (
                            <div className="h-16 w-1 bg-bitcoin-orange mx-3 my-1"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ConceptCard 
                title="Decentralized Ledger" 
                icon={<Database className="h-5 w-5" />}
                color="blue"
              >
                <p>
                  Bitcoin's blockchain is a distributed ledger that maintains a continuously growing list of transaction records,
                  hardened against tampering and revision through its decentralized network of nodes.
                </p>
                <p className="mt-2">
                  No single entity controls the Bitcoin blockchain - instead, it's maintained by thousands of computers (nodes) 
                  around the world that all store a copy of the ledger.
                </p>
              </ConceptCard>
              
              <ConceptCard 
                title="Immutability" 
                icon={<Shield className="h-5 w-5" />}
                color="purple"
              >
                <p>
                  Once a block has been added to the blockchain, it becomes extremely difficult to alter its content.
                  This property comes from cryptographic hash functions that link each block to the previous one.
                </p>
                <p className="mt-2">
                  Any change to a block would require changing all subsequent blocks, which would require redoing all the
                  proof-of-work for those blocks - a nearly impossible task.
                </p>
              </ConceptCard>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-8 animate-fade-in">
            <Card className="mb-8" isGlowing>
              <h2 className="text-2xl font-bold mb-4 gradient-text">Bitcoin Transactions</h2>
              
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-1/2">
                  <p className="mb-4">
                    Bitcoin transactions represent a transfer of value between Bitcoin wallets. They're recorded on
                    the blockchain and verified by network nodes through cryptography.
                  </p>
                  <p className="mb-4">
                    Each transaction contains:
                  </p>
                  <ul className="list-disc pl-5 mb-4 space-y-2">
                    <li><strong className="text-bitcoin-orange">Inputs</strong>: References to previous transaction outputs being spent</li>
                    <li><strong className="text-bitcoin-orange">Outputs</strong>: Specifies where the bitcoins are being sent to</li>
                    <li><strong className="text-bitcoin-orange">Amount</strong>: How many bitcoins are being transferred</li>
                    <li><strong className="text-bitcoin-orange">Signature</strong>: Proof that the sender has permission to spend these bitcoins</li>
                  </ul>
                </div>
                <div className="lg:w-1/2 flex justify-center">
                  <div className="w-full max-w-md">
                    <div className="glass-panel border border-gray-700 p-4 rounded-lg relative">
                      <div className="text-center mb-4 text-lg font-semibold">Transaction Flow</div>
                      
                      {/* Sender */}
                      <div className="bg-gray-800 p-3 rounded-lg mb-8 relative">
                        <div className="absolute -top-3 left-4 bg-bitcoin-orange text-black text-xs px-2 py-1 rounded-full">
                          Sender
                        </div>
                        <div className="flex items-center">
                          <Wallet className="h-8 w-8 text-bitcoin-orange mr-2" />
                          <div>
                            <div className="text-sm font-mono">1A2b...3C4d</div>
                            <div className="text-xs text-gray-400">Balance: 1.24 BTC</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Arrow */}
                      <div className="flex justify-center mb-8">
                        <div className="flex flex-col items-center">
                          <div className="h-16 w-1 bg-bitcoin-orange"></div>
                          <div className="h-3 w-3 rounded-full bg-bitcoin-orange"></div>
                          <div className="mt-2 text-xs text-white">
                            0.5 BTC
                          </div>
                        </div>
                      </div>
                      
                      {/* Receiver */}
                      <div className="bg-gray-800 p-3 rounded-lg relative">
                        <div className="absolute -top-3 left-4 bg-green-600 text-black text-xs px-2 py-1 rounded-full">
                          Receiver
                        </div>
                        <div className="flex items-center">
                          <Wallet className="h-8 w-8 text-green-500 mr-2" />
                          <div>
                            <div className="text-sm font-mono">5E6f...7G8h</div>
                            <div className="text-xs text-gray-400">Receiving: 0.5 BTC</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'mining' && (
          <div className="space-y-8 animate-fade-in">
            <Card className="mb-8" isGlowing>
              <h2 className="text-2xl font-bold mb-4 gradient-text">Bitcoin Mining</h2>
              
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-1/2">
                  <p className="mb-4">
                    Mining is the process where new Bitcoin transactions are verified and added to the blockchain.
                    It's a competitive computational process that secures the network.
                  </p>
                  <p className="mb-4">
                    The mining process:
                  </p>
                  <ol className="list-decimal pl-5 mb-4 space-y-2">
                    <li>Miners collect unconfirmed transactions into a block</li>
                    <li>They compute a hash for the block that meets specific difficulty requirements</li>
                    <li>The first miner to find a valid hash broadcasts the block to the network</li>
                    <li>Other nodes verify the block and add it to their copy of the blockchain</li>
                    <li>The successful miner receives newly created bitcoins as a reward</li>
                  </ol>
                </div>
                <div className="lg:w-1/2 flex justify-center">
                  <div className="w-full max-w-md">
                    <div className="glass-panel border border-gray-700 p-4 rounded-lg">
                      <div className="text-center mb-4">Mining Process Visualization</div>
                      
                      <div className="flex flex-col items-center">
                        {/* Unconfirmed Transaction Pool */}
                        <div className="bg-gray-800 p-3 rounded-lg mb-4 w-full">
                          <div className="text-sm mb-2">Unconfirmed Transaction Pool</div>
                          <div className="grid grid-cols-3 gap-1">
                            {[...Array(6)].map((_, i) => (
                              <div key={i} className="bg-gray-700 h-6 rounded flex items-center justify-center">
                                <span className="text-xs font-mono">tx_{i}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Arrow */}
                        <div className="h-8 w-1 bg-bitcoin-orange mb-4"></div>
                        
                        {/* Mining - Finding Nonce */}
                        <div className="bg-gray-800 p-3 rounded-lg mb-4 w-full">
                          <div className="text-sm mb-2">Mining (Finding Nonce)</div>
                          <div className="animate-pulse-fast flex justify-between">
                            <div className="text-xs font-mono">Nonce: 29473834</div>
                            <div className="text-xs font-mono">Hash: 0000a2...</div>
                          </div>
                        </div>
                        
                        {/* Arrow */}
                        <div className="h-8 w-1 bg-green-500 mb-4"></div>
                        
                        {/* Block Added */}
                        <div className="bg-gray-800 border border-green-500 p-3 rounded-lg w-full">
                          <div className="text-sm mb-2 text-green-500">New Block Found! 🎉</div>
                          <div className="text-xs font-mono">Block #762919 added to blockchain</div>
                          <div className="text-xs font-mono text-green-500">Reward: 6.25 BTC</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'utxo' && (
          <div className="space-y-8 animate-fade-in">
            <Card className="mb-8" isGlowing>
              <h2 className="text-2xl font-bold mb-4 gradient-text">UTXO Model</h2>
              
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-1/2">
                  <p className="mb-4">
                    Bitcoin uses an Unspent Transaction Output (UTXO) model to track balances. Unlike a traditional
                    account-based system, Bitcoin doesn't maintain a balance per address. Instead, it keeps track
                    of unspent transaction outputs.
                  </p>
                  <p className="mb-4">
                    Key characteristics of the UTXO model:
                  </p>
                  <ul className="list-disc pl-5 mb-4 space-y-2">
                    <li>UTXOs are indivisible - they must be spent entirely</li>
                    <li>When you spend a UTXO, you create new UTXOs for the recipients</li>
                    <li>If you send less than the full UTXO amount, you create a "change" UTXO back to yourself</li>
                    <li>Your wallet balance is the sum of all UTXOs that can be unlocked with your private keys</li>
                  </ul>
                </div>
                <div className="lg:w-1/2 flex justify-center">
                  <div className="w-full max-w-md">
                    <div className="glass-panel border border-gray-700 p-4 rounded-lg">
                      <div className="text-center mb-6">UTXO Example</div>
                      
                      {/* Input UTXOs */}
                      <div className="mb-6">
                        <div className="text-sm mb-2">Input (UTXOs being spent)</div>
                        <div className="bg-gray-800 rounded-lg p-3 mb-2">
                          <div className="flex justify-between">
                            <span className="text-xs font-mono">UTXO #1</span>
                            <span className="text-xs font-mono">0.8 BTC</span>
                          </div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <div className="flex justify-between">
                            <span className="text-xs font-mono">UTXO #2</span>
                            <span className="text-xs font-mono">0.5 BTC</span>
                          </div>
                        </div>
                        <div className="text-right text-sm mt-1">Total: 1.3 BTC</div>
                      </div>
                      
                      {/* Arrow */}
                      <div className="flex justify-center mb-6">
                        <div className="h-12 w-1 bg-bitcoin-orange"></div>
                      </div>
                      
                      {/* Output UTXOs */}
                      <div>
                        <div className="text-sm mb-2">Output (New UTXOs created)</div>
                        <div className="bg-gray-800 rounded-lg p-3 mb-2 border-l-4 border-green-500">
                          <div className="flex justify-between">
                            <span className="text-xs font-mono">To: Recipient</span>
                            <span className="text-xs font-mono">1.0 BTC</span>
                          </div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3 border-l-4 border-blue-500">
                          <div className="flex justify-between">
                            <span className="text-xs font-mono">To: Sender (Change)</span>
                            <span className="text-xs font-mono">0.29 BTC</span>
                          </div>
                        </div>
                        <div className="text-right text-sm mt-1">Fee: 0.01 BTC</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'keys' && (
          <div className="space-y-8 animate-fade-in">
            <Card className="mb-8" isGlowing>
              <h2 className="text-2xl font-bold mb-4 gradient-text">Keys & Security</h2>
              
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-1/2">
                  <p className="mb-4">
                    Bitcoin uses public-key cryptography to secure transactions. Users have a pair of cryptographic
                    keys: a public key that can be shared with anyone, and a private key that must be kept secret.
                  </p>
                  <p className="mb-4">
                    How keys work in Bitcoin:
                  </p>
                  <ul className="list-disc pl-5 mb-4 space-y-2">
                    <li>Your <strong className="text-bitcoin-orange">public key</strong> is used to generate your Bitcoin address</li>
                    <li>Your <strong className="text-bitcoin-orange">private key</strong> is used to sign transactions, proving ownership</li>
                    <li>Anyone can verify your signature using your public key, but they can't create valid signatures without your private key</li>
                    <li>If you lose your private key, you permanently lose access to your bitcoins</li>
                  </ul>
                </div>
                <div className="lg:w-1/2 flex justify-center">
                  <div className="w-full max-w-md">
                    <div className="glass-panel border border-gray-700 p-4 rounded-lg">
                      <div className="text-center mb-4">Public & Private Keys</div>
                      
                      <div className="flex flex-col space-y-6">
                        {/* Private Key */}
                        <div className="bg-gray-800 p-3 rounded-lg relative">
                          <div className="absolute -top-3 left-4 bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center">
                            <Lock className="h-3 w-3 mr-1" />
                            Private Key
                          </div>
                          <div className="mt-2">
                            <div className="text-xs font-mono bg-gray-900 p-2 rounded overflow-x-auto">
                              5KJvsngHeMpm884wtkJNzQGaCErckhHJBGFsvd3VyK5qMZXj3hS
                            </div>
                            <div className="text-xs text-red-400 mt-1 flex items-center">
                              <Lock className="h-3 w-3 mr-1" />
                              Never share this with anyone!
                            </div>
                          </div>
                        </div>
                        
                        {/* Arrow */}
                        <div className="flex justify-center">
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-1 bg-bitcoin-orange"></div>
                            <div className="text-xs">generates</div>
                          </div>
                        </div>
                        
                        {/* Public Key */}
                        <div className="bg-gray-800 p-3 rounded-lg relative">
                          <div className="absolute -top-3 left-4 bg-green-600 text-white text-xs px-2 py-1 rounded-full flex items-center">
                            <Unlock className="h-3 w-3 mr-1" />
                            Public Key
                          </div>
                          <div className="mt-2">
                            <div className="text-xs font-mono bg-gray-900 p-2 rounded overflow-x-auto">
                              0244f0c6f6d0a5b42f3829cf5cd1871e9b79ad6bc3c32a0b03da3c4994a9cd67c9
                            </div>
                          </div>
                        </div>
                        
                        {/* Arrow */}
                        <div className="flex justify-center">
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-1 bg-bitcoin-orange"></div>
                            <div className="text-xs">hashed to create</div>
                          </div>
                        </div>
                        
                        {/* Bitcoin Address */}
                        <div className="bg-gray-800 p-3 rounded-lg relative">
                          <div className="absolute -top-3 left-4 bg-bitcoin-orange text-black text-xs px-2 py-1 rounded-full flex items-center">
                            <Bitcoin className="h-3 w-3 mr-1" />
                            Bitcoin Address
                          </div>
                          <div className="mt-2">
                            <div className="text-xs font-mono bg-gray-900 p-2 rounded overflow-x-auto">
                              1PMycacnJaSqwwJqjawXBErnLsZ7RkXUAs
                            </div>
                            <div className="text-xs text-green-400 mt-1 flex items-center">
                              <Unlock className="h-3 w-3 mr-1" />
                              Safe to share with others
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="space-y-8 animate-fade-in">
            <Card className="mb-8" isGlowing>
              <h2 className="text-2xl font-bold mb-4 gradient-text">Bitcoin Wallets</h2>
              
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-1/2">
                  <p className="mb-4">
                    A Bitcoin wallet doesn't actually store bitcoins. Instead, it stores the cryptographic keys
                    needed to access and manage your bitcoin on the blockchain.
                  </p>
                  <p className="mb-4">
                    Types of Bitcoin wallets:
                  </p>
                  <ul className="list-disc pl-5 mb-4 space-y-2">
                    <li><strong className="text-bitcoin-orange">Hot wallets</strong>: Connected to the internet (e.g., mobile apps, desktop software)</li>
                    <li><strong className="text-bitcoin-orange">Cold wallets</strong>: Offline storage (e.g., hardware wallets, paper wallets)</li>
                    <li><strong className="text-bitcoin-orange">Full node wallets</strong>: Store the entire blockchain</li>
                    <li><strong className="text-bitcoin-orange">Light wallets</strong>: Connect to other nodes to verify transactions</li>
                  </ul>
                  <p>
                    Wallet software typically handles key management, transaction creation, signing, 
                    and broadcasting to the network - all behind a user-friendly interface.
                  </p>
                </div>
                <div className="lg:w-1/2 flex justify-center">
                  <div className="w-full max-w-md">
                    <div className="glass-panel border border-gray-700 p-4 rounded-lg">
                      <div className="text-center mb-4">Wallet Components</div>
                      
                      <div className="space-y-4">
                        {/* Seed/Recovery Phrase */}
                        <div className="bg-gray-800 p-3 rounded-lg">
                          <div className="text-sm font-semibold mb-2 text-yellow-400 flex items-center">
                            <BookOpen className="h-4 w-4 mr-2" />
                            Seed/Recovery Phrase
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {["abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse", "access", "accident"].map((word, i) => (
                              <div key={i} className="bg-gray-900 rounded p-1 text-center">
                                <span className="text-xs font-mono">{i+1}. {word}</span>
                              </div>
                            ))}
                          </div>
                          <div className="text-xs text-red-400 mt-2">Keep this secret and secure!</div>
                        </div>
                        
                        {/* Derived Keys */}
                        <div className="bg-gray-800 p-3 rounded-lg">
                          <div className="text-sm font-semibold mb-2 text-blue-400 flex items-center">
                            <Key className="h-4 w-4 mr-2" />
                            Multiple Key Pairs (HD Wallet)
                          </div>
                          <div className="space-y-2">
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="bg-gray-900 rounded p-2 flex justify-between">
                                <span className="text-xs font-mono">Address #{i}</span>
                                <span className="text-xs font-mono truncate ml-2 w-32">1A2b...{i}Z</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Transaction History */}
                        <div className="bg-gray-800 p-3 rounded-lg">
                          <div className="text-sm font-semibold mb-2 text-green-400 flex items-center">
                            <LinkIcon className="h-4 w-4 mr-2" />
                            Transaction History
                          </div>
                          <div className="space-y-2">
                            <div className="bg-gray-900 rounded p-2 flex justify-between">
                              <span className="text-xs text-green-500">+0.1 BTC</span>
                              <span className="text-xs text-gray-400">Yesterday</span>
                            </div>
                            <div className="bg-gray-900 rounded p-2 flex justify-between">
                              <span className="text-xs text-red-500">-0.05 BTC</span>
                              <span className="text-xs text-gray-400">Last week</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ConceptCard 
                title="Hardware Wallets" 
                icon={<Shield className="h-5 w-5" />}
                color="green"
              >
                <p>
                  Hardware wallets store private keys offline on a physical device. They're considered 
                  the most secure option as the keys never touch an internet-connected computer.
                </p>
                <p className="mt-2">
                  Popular hardware wallets include Ledger and Trezor devices, which allow you to sign 
                  transactions securely even if your computer is compromised.
                </p>
              </ConceptCard>
              
              <ConceptCard 
                title="Multi-signature Wallets" 
                icon={<Key className="h-5 w-5" />}
                color="purple"
              >
                <p>
                  Multi-signature (multisig) wallets require multiple private keys to authorize a transaction,
                  rather than just one. For example, a 2-of-3 multisig wallet requires two signatures from 
                  three possible keys.
                </p>
                <p className="mt-2">
                  This adds security by preventing a single point of failure and is commonly 
                  used for business accounts or shared funds.
                </p>
              </ConceptCard>
            </div>
          </div>
        )}

        {activeTab === 'news' && (
          <div className="space-y-8 animate-fade-in">
            <Card className="mb-8" isGlowing>
              <h2 className="text-2xl font-bold mb-6 gradient-text">Latest Bitcoin News</h2>
              
              <div className="space-y-6">
                {loading ? (
                  // Loading state
                  Array.from({ length: 5 }).map((_, index) => (
                    <div key={`loading-news-${index}`} className="border-b border-gray-700 pb-6 last:border-0">
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="md:w-1/4 h-48 md:h-auto">
                          <div className="w-full h-full rounded-lg bg-bitcoin-gray animate-pulse"></div>
                        </div>
                        <div className="md:w-3/4">
                          <div className="h-4 bg-bitcoin-gray animate-pulse rounded mb-3 w-1/4"></div>
                          <div className="h-7 bg-bitcoin-gray animate-pulse rounded mb-4 w-3/4"></div>
                          <div className="h-4 bg-bitcoin-gray animate-pulse rounded mb-2"></div>
                          <div className="h-4 bg-bitcoin-gray animate-pulse rounded mb-2"></div>
                          <div className="h-4 bg-bitcoin-gray animate-pulse rounded mb-4"></div>
                          <div className="h-4 bg-bitcoin-gray animate-pulse rounded w-1/5"></div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  // Show real Bitcoin news
                  bitcoinNews.map((item) => (
                    <div key={item.id} className="border-b border-gray-700 pb-6 last:border-0">
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="md:w-1/4 h-48 md:h-auto relative">
                          <div className="w-full h-full relative rounded-lg overflow-hidden bg-bitcoin-gray">
                            <Image 
                              src={item.image} 
                              alt={item.headline}
                              fill
                              style={{ objectFit: 'cover' }}
                              onError={(e) => {
                                // On error, replace with a fallback image URL from the same domain
                                const target = e.target as HTMLImageElement;
                                target.onerror = null; // Prevent infinite loop
                                target.src = 'https://cdn.sanity.io/images/s3y3vcno/production/e7982f2cd16aaa896fdd1b231cf766d18f1f1cc2-1440x1080.jpg';
                              }}
                              unoptimized={true} // Skip Next.js image optimization for some problematic URLs
                            />
                          </div>
                          <div className="absolute top-2 left-2 bg-bitcoin-orange text-black text-xs font-bold px-2 py-1 rounded">
                            {item.source}
                          </div>
                        </div>
                        
                        <div className="md:w-3/4">
                          <div className="flex items-center text-sm text-gray-400 mb-2">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>{formatDate(item.datetime)}</span>
                          </div>
                          
                          <h3 className="text-xl font-bold mb-3">{item.headline}</h3>
                          
                          <p className="text-gray-300 mb-4">{item.summary}</p>
                          
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-bitcoin-orange hover:underline"
                          >
                            Read Full Article <ExternalLink className="h-4 w-4 ml-1" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                
                <div className="text-center mt-8">
                  <Link 
                    href="/news" 
                    className="inline-flex items-center justify-center px-6 py-3 bg-bitcoin-orange text-black font-bold rounded-lg hover:bg-bitcoin-orange/80 transition-colors"
                  >
                    View All Bitcoin News <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

    
      {/* News Bar - Always Visible */}
      <div className="mb-10">
        <Card isGlowing className="overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center">
                <Newspaper className="mr-2 h-5 w-5 text-bitcoin-orange" />
                Latest Bitcoin News
              </h2>
              <Link 
                href="/news" 
                className="text-bitcoin-orange hover:underline flex items-center text-sm"
              >
                View All News <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {loading ? (
                // Loading state - skeleton cards
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={`loading-${index}`} className="bg-bitcoin-dark rounded-lg overflow-hidden">
                    <div className="h-40 bg-bitcoin-gray animate-pulse rounded-t-lg"></div>
                    <div className="p-4">
                      <div className="h-4 bg-bitcoin-gray animate-pulse rounded mb-2 w-1/3"></div>
                      <div className="h-5 bg-bitcoin-gray animate-pulse rounded mb-2"></div>
                      <div className="h-5 bg-bitcoin-gray animate-pulse rounded mb-2"></div>
                      <div className="h-4 bg-bitcoin-gray animate-pulse rounded mb-3 w-2/3"></div>
                      <div className="h-4 bg-bitcoin-gray animate-pulse rounded w-1/4"></div>
                    </div>
                  </div>
                ))
              ) : (
                // Only show 3 news items in the top bar
                bitcoinNews.slice(0, 3).map((item) => (
                  <div key={item.id} className="bg-bitcoin-dark rounded-lg overflow-hidden hover:ring-1 hover:ring-bitcoin-orange transition duration-300">
                    <div className="h-40 relative bg-bitcoin-gray">
                      <Image 
                        src={item.image} 
                        alt={item.headline}
                        fill
                        style={{ objectFit: 'cover' }}
                        onError={(e) => {
                          // On error, replace with a fallback image URL from the same domain
                          const target = e.target as HTMLImageElement;
                          target.onerror = null; // Prevent infinite loop
                          target.src = 'https://cdn.sanity.io/images/s3y3vcno/production/e7982f2cd16aaa896fdd1b231cf766d18f1f1cc2-1440x1080.jpg';
                        }}
                        unoptimized={true} // Skip Next.js image optimization for some problematic URLs
                      />
                      <div className="absolute top-2 left-2 bg-bitcoin-orange text-black text-xs font-bold px-2 py-1 rounded">
                        {item.source}
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center text-xs text-gray-400 mb-2">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>{formatDate(item.datetime)}</span>
                      </div>
                      <h3 className="font-bold mb-2 line-clamp-2 hover:text-bitcoin-orange transition-colors">{item.headline}</h3>
                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{item.summary}</p>
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-bitcoin-orange text-sm hover:underline"
                      >
                        Read Article <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
} 