export async function getBitcoinPrice(date: string) {
  try {
    // Convert date to timestamp
    const timestamp = Math.floor(new Date(date).getTime() / 1000);
    
    // Use CoinGecko API for historical price
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${date}&localization=false`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      date,
      timestamp,
      price: data.market_data?.current_price?.usd || null,
      market_cap: data.market_data?.market_cap?.usd || null,
      volume: data.market_data?.total_volume?.usd || null
    };
  } catch (error) {
    console.error('Error fetching Bitcoin price for date:', date, error);
    return null;
  }
}

export async function getCurrentBitcoinPrice() {
  try {
    // Use CryptoCompare API for current price
    const response = await fetch(
      'https://min-api.cryptocompare.com/data/v2/histominute?fsym=BTC&tsym=USD&limit=48'
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.Response !== 'Success' || !data.Data || !data.Data.Data || data.Data.Data.length === 0) {
      throw new Error('Invalid response from CryptoCompare API');
    }
    
    const latestData = data.Data.Data[0];
    const closePrice = latestData.close;
    
    return {
      timestamp: Math.floor(Date.now() / 1000),
      price: closePrice,
      market_cap: null, // Not available from this endpoint
      volume: null, // Not available from this endpoint
      change_24h: null // Not available from this endpoint
    };
  } catch (error) {
    console.error('Error fetching current Bitcoin price:', error);
    return null;
  }
} 