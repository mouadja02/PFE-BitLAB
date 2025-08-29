"use client";

import React from 'react';
import { Card } from '@/components/ui/Card';
import { 
  Newspaper, 
  Calendar, 
  ExternalLink, 
  Search,
  ArrowLeft,
  ArrowRight,
  Bitcoin,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// Define NewsItem interface for CryptoCompare API
interface NewsItem {
  id: string;
  guid: string;
  published_on: number;
  imageurl: string;
  title: string;
  url: string;
  body: string;
  tags: string;
  lang: string;
  upvotes: string;
  downvotes: string;
  categories: string;
  source_info: {
    name: string;
    img: string;
    lang: string;
  };
  source: string;
}

// CryptoCompare API response interface
interface CryptoCompareNewsResponse {
  Type: number;
  Message: string;
  Promoted: any[];
  Data: NewsItem[];
}

export default function NewsPage() {
  const [news, setNews] = React.useState<NewsItem[]>([]);
  const [filteredNews, setFilteredNews] = React.useState<NewsItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;
  
  // Format date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  React.useEffect(() => {
    fetchNews();
  }, []);
  
  React.useEffect(() => {
    if (news.length > 0) {
      applyFilters();
    }
  }, [searchQuery, news]);
  
  const fetchNews = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch news from CryptoCompare API
      const response = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch news: ${response.status}`);
      }
      
      const newsResponse: CryptoCompareNewsResponse = await response.json();
      
      // Filter for Bitcoin-related news items (already filtered by BTC category, but double-check)
      const bitcoinNews = newsResponse.Data.filter((item: NewsItem) => 
        item.title.toLowerCase().includes('bitcoin') || 
        item.title.toLowerCase().includes('btc') ||
        item.body.toLowerCase().includes('bitcoin') ||
        item.body.toLowerCase().includes('btc') ||
        item.categories.toLowerCase().includes('btc')
      );
      
      setNews(bitcoinNews);
      setFilteredNews(bitcoinNews);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching news:', err);
      setError('Failed to fetch news. Please try again later.');
      setLoading(false);
    }
  };
  
  const applyFilters = () => {
    let filtered = [...news];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.body.toLowerCase().includes(query) ||
        item.source_info.name.toLowerCase().includes(query)
      );
    }
    
    setFilteredNews(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };
  
  // Pagination logic
  const totalPages = Math.ceil(filteredNews.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredNews.slice(indexOfFirstItem, indexOfLastItem);
  
  const goToPage = (pageNumber: number) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber);
  };
  
  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-extrabold text-white gradient-text mb-3 flex items-center">
            <Newspaper className="mr-3 h-8 w-8 text-bitcoin-orange" />
            Bitcoin News
          </h1>
          <p className="text-lg text-gray-300">
            Latest news and updates about Bitcoin from across the web
          </p>
        </div>
        <Link 
          href="/learn" 
          className="text-bitcoin-orange hover:underline flex items-center"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Learn
        </Link>
      </div>
      
      {/* Search and Filter */}
      <Card className="mb-8 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-md bg-bitcoin-dark text-white focus:outline-none focus:ring-2 focus:ring-bitcoin-orange"
              placeholder="Search news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <button 
            onClick={fetchNews}
            className="flex items-center justify-center px-4 py-2 bg-bitcoin-orange text-black font-medium rounded-md hover:bg-bitcoin-orange/80 transition-colors"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh News
          </button>
        </div>
      </Card>
      
      {/* News Content */}
      {loading ? (
        <div className="flex justify-center items-center my-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bitcoin-orange"></div>
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-xl text-gray-300 mb-4">{error}</p>
          <button
            onClick={fetchNews}
            className="px-4 py-2 bg-bitcoin-orange text-black font-medium rounded-md hover:bg-bitcoin-orange/80 transition-colors"
          >
            Try Again
          </button>
        </Card>
      ) : filteredNews.length === 0 ? (
        <Card className="p-8 text-center">
          <Bitcoin className="h-12 w-12 text-bitcoin-orange mx-auto mb-4" />
          <p className="text-xl text-gray-300 mb-4">No news matching your search criteria</p>
          <button
            onClick={() => setSearchQuery('')}
            className="px-4 py-2 bg-bitcoin-orange text-black font-medium rounded-md hover:bg-bitcoin-orange/80 transition-colors"
          >
            Clear Search
          </button>
        </Card>
      ) : (
        <>
          <div className="space-y-6">
            {currentItems.map((item: NewsItem) => (
              <Card key={item.id} className="overflow-hidden hover:ring-1 hover:ring-bitcoin-orange transition duration-300">
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-1/4 h-60 md:h-auto relative bg-bitcoin-gray">
                    <div className="w-full h-full relative">
                      <Image 
                        src={item.imageurl || 'https://cdn.sanity.io/images/s3y3vcno/production/e7982f2cd16aaa896fdd1b231cf766d18f1f1cc2-1440x1080.jpg'} 
                        alt={item.title}
                        fill
                        style={{ objectFit: 'cover' }}
                        className="rounded-t-lg md:rounded-l-lg md:rounded-t-none"
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
                      {item.source_info.name}
                    </div>
                  </div>
                  
                  <div className="md:w-3/4 p-6">
                    <div className="flex items-center text-sm text-gray-400 mb-2">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{formatDate(item.published_on)}</span>
                    </div>
                    
                    <h2 className="text-xl font-bold mb-3 hover:text-bitcoin-orange transition-colors">
                      {item.title}
                    </h2>
                    
                    <p className="text-gray-300 mb-4">{item.body.substring(0, 200)}...</p>
                    
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
              </Card>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <nav className="inline-flex rounded-md shadow">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded-l-md border border-gray-700 
                    ${currentPage === 1 
                      ? 'bg-bitcoin-gray/50 text-gray-500 cursor-not-allowed' 
                      : 'bg-bitcoin-gray text-white hover:bg-bitcoin-orange hover:text-black'
                    }`}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => goToPage(i + 1)}
                    className={`px-3 py-1 border-t border-b border-gray-700
                      ${currentPage === i + 1
                        ? 'bg-bitcoin-orange text-black font-bold'
                        : 'bg-bitcoin-gray text-white hover:bg-bitcoin-orange/20'
                      }`}
                  >
                    {i + 1}
                  </button>
                ))}
                
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded-r-md border border-gray-700
                    ${currentPage === totalPages
                      ? 'bg-bitcoin-gray/50 text-gray-500 cursor-not-allowed'
                      : 'bg-bitcoin-gray text-white hover:bg-bitcoin-orange hover:text-black'
                    }`}
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
}
