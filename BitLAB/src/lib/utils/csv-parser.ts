interface BtcDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trade_volume: number;
  nasdaq: number;
  gold: number;
  dxy: number;
  mvrv: number;
  nupl: number;
  fng_value: number;
  m2_global_supply: number;
  sma_5: number;
  sma_20: number;
  sma_50: number;
  ema_12: number;
  ema_26: number;
  macd: number;
  macd_signal: number;
  macd_hist: number;
  rsi: number;
  bb_middle: number;
  bb_upper: number;
  bb_lower: number;
  price_change_1d: number;
  price_change_5d: number;
  price_change_20d: number;
}

interface BitcoinData {
  date: string;
  price: number;
  fng: number; // Fear and Greed Index
}

/**
 * Parse CSV data into an array of data points
 */
export function parseCSV(csvData: string): BtcDataPoint[] {
  const lines = csvData.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const dataPoint: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      const value = values[index];
      dataPoint[header.toLowerCase()] = header.toLowerCase() === 'date' 
        ? value 
        : parseFloat(value) || 0;
    });
    
    return dataPoint as BtcDataPoint;
  });
}

/**
 * Get available metrics from the data
 */
export function getAvailableMetrics(data: BtcDataPoint[]): string[] {
  if (data.length === 0) return [];
  return Object.keys(data[0]).filter(key => key !== 'date');
}

export function parseCsvData(csvContent: string): {
  bitcoinData: BtcDataPoint[]; 
} {
  // Split CSV content into lines and remove empty lines
  const lines = csvContent
    .split('\n')
    .filter(line => line.trim() !== '');
  
  // Get headers (first line)
  const headers = lines[0].split(',').map(header => header.trim().toLowerCase()); // Ensure headers are lowercase

  // Parse data rows
  const bitcoinData: BtcDataPoint[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(value => value.trim());
    const dataPoint: Record<string, any> = {};
    
    if (values.length === headers.length) { // Ensure the row has the same number of columns as headers
      headers.forEach((header, index) => {
        const value = values[index];
        // Assign value based on header name, converting numbers where appropriate
        if (header === 'date') {
          dataPoint[header] = value; // Keep date as string
        } else {
          // Attempt to parse as float, default to 0 if NaN or empty
          const numValue = parseFloat(value);
          dataPoint[header] = isNaN(numValue) ? 0 : numValue; 
        }
      });
      
      // Basic validation: check if date exists
      if (dataPoint.date) {
         bitcoinData.push(dataPoint as BtcDataPoint);
      }
    }
  }

  // Sort by date (oldest first for easier filtering/charting)
  bitcoinData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  return {
    bitcoinData // Return the array of BtcDataPoint
  };
}

export type { BtcDataPoint }; 