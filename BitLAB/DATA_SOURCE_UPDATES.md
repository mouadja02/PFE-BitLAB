# Bitcoin Website Data Source Updates

## Overview
This document summarizes all the data source updates made to the BitLAB Bitcoin website according to the specified requirements.

## Updated Data Sources

### 1. Bitcoin Current Price
**Previous Source**: CoinGecko API
**New Source**: CryptoCompare API
- **Endpoint**: `https://min-api.cryptocompare.com/data/v2/histominute?fsym=BTC&tsym=USD&limit=1`
- **Data Extraction**: Close price from the latest minute data
- **Files Updated**:
  - `src/lib/api/bitcoin-price.ts` - Updated `getCurrentBitcoinPrice()` function
  - `src/app/api/btc-price-minute/route.ts` - Already using CryptoCompare (no changes needed)

### 2. Network Hash Rate, Mining Difficulty, Bitcoin Supply
**Previous Source**: bitcoin-data.com API
**New Source**: CryptoCompare Blockchain API
- **Endpoint**: `https://min-api.cryptocompare.com/data/blockchain/latest?fsym=BTC&api_key=04332ea0e83e70ad6830bd9d78a34a03d0d78a953752d87e1b7d3fce72288673`
- **Data Fields**:
  - Network Hash Rate: `hashrate`
  - Mining Difficulty: `difficulty`
  - Bitcoin Supply: `current_supply`
- **Files Updated**:
  - `src/app/api/blockchain-metrics/route.ts` - New API endpoint
  - `src/hooks/useBlockchainMetrics.ts` - New hook for blockchain metrics
  - `src/lib/api/bitcoin-metrics.ts` - Updated `fetchDashboardMetrics()`, `getBitcoinHashrate()`, `getBitcoinDifficulty()`

### 3. Bitcoin Dominance (Replaced with Active Addresses)
**Previous Source**: bitcoin-data.com dominance endpoint
**New Source**: Active addresses from CryptoCompare Blockchain API
- **Data Field**: `active_addresses`
- **Display**: Shows active addresses in millions (e.g., "0.77M")
- **Files Updated**:
  - `src/lib/api/bitcoin-metrics.ts` - Updated `getBitcoinDominance()` function
  - `src/app/page.tsx` - Updated display title from "Dominance" to "Active Addresses"

### 4. Bitcoin Historical Price
**Previous Source**: CoinGecko API
**New Source**: Snowflake database
- **Table**: `BTC_DATA.DATA.OHCLV_DATA`
- **Schema**:
  ```sql
  CREATE TABLE BTC_DATA.DATA.OHCLV_DATA (
    DATE DATE,
    OPEN NUMBER(20,2),
    HIGH NUMBER(20,2),
    LOW NUMBER(20,2),
    CLOSE NUMBER(20,2),
    VOLUME NUMBER(30,2)
  );
  ```
- **Files Updated**:
  - `src/app/api/ohlcv/route.ts` - Updated table reference

### 5. Latest Blockchain Blocks
**Previous Source**: Existing Snowflake database
**New Source**: Snowflake marketplace database
- **Database**: `BITCOIN_ONCHAIN_CORE_DATA` (from Snowflake marketplace)
- **Table**: `BITCOIN_ONCHAIN_CORE_DATA.core.FACT_BLOCKS`
- **Files Updated**:
  - `src/app/api/blockchain/latest-blocks/route.ts` - Updated database reference

### 6. Bitcoin Realized Price
**Previous Source**: `BTC_REALIZED_CAP_AND_PRICE` table
**New Source**: New Snowflake table
- **Table**: `BTC_DATA.DATA.REALIZED_PRICE`
- **Schema**:
  ```sql
  CREATE TABLE BTC_DATA.DATA.REALIZED_PRICE (
    DATE DATE,
    REALIZED_PRICE FLOAT
  );
  ```
- **Files Updated**:
  - `src/app/api/realized-price/route.ts` - Updated table reference and column name

### 7. Puell Multiple
**Previous Source**: bitcoin-data.com API
**New Source**: bitcoin-data.com API (new endpoint)
- **Endpoint**: `https://bitcoin-data.com/v1/puell-multiple/latest`
- **Response Format**:
  ```json
  {
    "d": "2025-07-24",
    "unixTs": "1753315200",
    "puellMultiple": "1.362"
  }
  ```
- **Files Updated**:
  - `src/app/api/puell-multiple/route.ts` - New API endpoint
  - `src/hooks/usePuellMultiple.ts` - New hook for Puell Multiple
  - `src/lib/api/bitcoin-metrics.ts` - Updated `fetchDashboardMetrics()` to use new endpoint

## New API Endpoints Created

1. **`/api/blockchain-metrics`** - Fetches network hash rate, mining difficulty, Bitcoin supply, and active addresses
2. **`/api/puell-multiple`** - Fetches the latest Puell Multiple value

## New Hooks Created

1. **`useBlockchainMetrics()`** - Hook for blockchain metrics data
2. **`usePuellMultiple()`** - Hook for Puell Multiple data

## Database Configuration Updates

- Updated Snowflake connection to use `BITCOIN_ONCHAIN_CORE_DATA` database for blockchain data
- Updated table references to use the correct schema and table names

## Testing

The development server has been started to test the new data sources. All endpoints should now be using the updated data sources as specified.

## Notes

- The Bitcoin price minute data was already using CryptoCompare API, so no changes were needed
- All new endpoints include proper error handling and caching headers
- The active addresses metric replaces the old dominance metric in the UI
- All changes maintain backward compatibility where possible 