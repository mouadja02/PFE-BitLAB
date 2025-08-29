import axios from 'axios';

export interface BitcoinPriceResponse {
  date: string;
  timestamp: number;
  price: number | null;
  market_cap: number | null;
  volume: number | null;
}

export interface HashRateResponse {
  d: string;
  unixTs: string;
  val: string;
}

export interface DifficultyResponse {
  d: string;
  unixTs: string;
  val: string;
}

export interface PuellMultipleResponse {
  d: string;
  unixTs: string;
  val: string;
}

export interface SupplyResponse {
  d: string;
  unixTs: string;
  val: string;
}

export interface DominanceResponse {
  d: string;
  unixTs: string;
  pct: string;
}

// Interfaces for advanced metrics
export interface MVRVResponse {
  d: string;
  unixTs: string;
  val: string;
}

export interface NUPLResponse {
  d: string;
  unixTs: string;
  val: string;
}

export interface ReserveRiskResponse {
  d: string;
  unixTs: string;
  val: string;
}

export interface SOPRResponse {
  d: string;
  unixTs: string;
  val: string;
}


export interface DashboardMetrics {
  price: BitcoinPriceResponse | null;
  hashrate: HashRateResponse | null;
  difficulty: DifficultyResponse | null;
  puellMultiple: PuellMultipleResponse | null;
  supply: SupplyResponse | null;
}

// Helper to get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Main dashboard metrics
export async function fetchDashboardMetrics(): Promise<DashboardMetrics | null> {
  try {
    // Fetch blockchain metrics from CryptoCompare API
    const blockchainMetricsResponse = await fetch('/api/blockchain-metrics');
    const blockchainMetrics = blockchainMetricsResponse.ok ? await blockchainMetricsResponse.json() : null;

    return {
      price: null, // Remove bitcoin-data.com price dependency
      hashrate: blockchainMetrics ? {
        d: new Date(blockchainMetrics.timestamp * 1000).toISOString().split('T')[0],
        unixTs: blockchainMetrics.timestamp.toString(),
        val: blockchainMetrics.networkHashRate.toString()
      } : null,
      difficulty: blockchainMetrics ? {
        d: new Date(blockchainMetrics.timestamp * 1000).toISOString().split('T')[0],
        unixTs: blockchainMetrics.timestamp.toString(),
        val: blockchainMetrics.miningDifficulty.toString()
      } : null,
      puellMultiple: null, // Remove bitcoin-data.com Puell Multiple dependency
      supply: blockchainMetrics ? {
        d: new Date(blockchainMetrics.timestamp * 1000).toISOString().split('T')[0],
        unixTs: blockchainMetrics.timestamp.toString(),
        val: blockchainMetrics.bitcoinSupply.toString()
      } : null
    };
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return null;
  }
}

// Bitcoin Price - Removed bitcoin-data.com dependency
// Use /api/btc-price-minute for current price instead

// Get Bitcoin Supply
export async function getBitcoinSupply(): Promise<SupplyResponse | null> {
  try {
    const blockchainMetricsResponse = await fetch('/api/blockchain-metrics');
    const blockchainMetrics = blockchainMetricsResponse.ok ? await blockchainMetricsResponse.json() : null;
    
    if (blockchainMetrics && blockchainMetrics.bitcoinSupply) {
      return {
        d: new Date(blockchainMetrics.timestamp * 1000).toISOString().split('T')[0],
        unixTs: blockchainMetrics.timestamp.toString(),
        val: blockchainMetrics.bitcoinSupply.toString()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Bitcoin supply:', error);
    return null;
  }
}

// Get Bitcoin Hashrate
export async function getBitcoinHashrate(): Promise<HashRateResponse | null> {
  try {
    const blockchainMetricsResponse = await fetch('/api/blockchain-metrics');
    const blockchainMetrics = blockchainMetricsResponse.ok ? await blockchainMetricsResponse.json() : null;
    
    if (blockchainMetrics && blockchainMetrics.networkHashRate) {
      return {
        d: new Date(blockchainMetrics.timestamp * 1000).toISOString().split('T')[0],
        unixTs: blockchainMetrics.timestamp.toString(),
        val: blockchainMetrics.networkHashRate.toString()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Bitcoin hashrate:', error);
    return null;
  }
}

// Get Bitcoin Difficulty
export async function getBitcoinDifficulty(): Promise<DifficultyResponse | null> {
  try {
    const blockchainMetricsResponse = await fetch('/api/blockchain-metrics');
    const blockchainMetrics = blockchainMetricsResponse.ok ? await blockchainMetricsResponse.json() : null;
    
    if (blockchainMetrics && blockchainMetrics.miningDifficulty) {
      return {
        d: new Date(blockchainMetrics.timestamp * 1000).toISOString().split('T')[0],
        unixTs: blockchainMetrics.timestamp.toString(),
        val: blockchainMetrics.miningDifficulty.toString()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Bitcoin difficulty:', error);
    return null;
  }
}

// Get Bitcoin Dominance
export async function getBitcoinActiveAddresses(): Promise<any | null> {
  try {
    // Fetch blockchain metrics from the new API endpoint
    const blockchainMetricsResponse = await fetch('/api/blockchain-metrics');
    const blockchainMetrics = blockchainMetricsResponse.ok ? await blockchainMetricsResponse.json() : null;
    
    if (blockchainMetrics && blockchainMetrics.activeAddresses) {
      // This is a placeholder - you may want to adjust this calculation based on your needs
      const activeAddresses = (blockchainMetrics.activeAddresses).toFixed(2); // Convert to millions and format
      
      return {
        d: new Date(blockchainMetrics.timestamp * 1000).toISOString().split('T')[0],
        unixTs: blockchainMetrics.timestamp.toString(),
        val: activeAddresses
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Bitcoin dominance (active addresses):', error);
    return null;
  }
}

export interface AdvancedMetrics {
  mvrv: MVRVResponse | null;
  nupl: NUPLResponse | null;
  reserveRisk: ReserveRiskResponse | null;
  sopr: SOPRResponse | null;
}

// Advanced Metrics - Disabled (bitcoin-data.com dependency removed)
export async function getAdvancedMetrics(): Promise<AdvancedMetrics | null> {
  console.log('Advanced metrics disabled - bitcoin-data.com dependency removed');
  return {
    mvrv: null,
    nupl: null,
    reserveRisk: null,
    sopr: null
  };
} 