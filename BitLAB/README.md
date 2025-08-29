# BitLAB Platform

A comprehensive web application for analyzing Bitcoin on-chain metrics, transactions, and market data using data stored in Snowflake.

## Features

- **Dashboard:** Overview of Bitcoin's market status with key metrics
- **Block Explorer:** Lookup and explore blocks and their transactions
- **Charts Section:** Interactive charts for various on-chain metrics including:
  - Hash Rate
  - Price
  - MVRV
  - Network Difficulty
  - And many more metrics

## Technology Stack

- **Frontend:** Next.js (React framework) with TypeScript
- **Styling:** Tailwind CSS for responsive design
- **Charts:** Chart.js with react-chartjs-2
- **Database:** Snowflake for storing and querying Bitcoin data
- **API:** Next.js API Routes for data fetching

## Data Sources

The application connects to two primary Snowflake databases:

1. **bitcoin_onchain_core_data.core** - Contains tables like:
   - FACT_BLOCKS
   - FACT_TRANSACTIONS
   - FACT_INPUTS
   - FACT_OUTPUTS
   - FACT_CLUSTERS_TRANSFERS
   - DIM_ENTITY_CLUSTERS

2. **BTC_DATA.DATA** - Contains tables with derived metrics:
   - BTC_PRICE_USD
   - HASH_RATE
   - TX_COUNT
   - ACTIVE_ADDRESSES
   - MVRV
   - FEAR_GREED_INDEX
   - And others

## Getting Started

### Prerequisites

- Node.js (v16.x or newer)
- npm or yarn
- Snowflake account with access to the Bitcoin datasets

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/bitcoin-analysis.git
   cd bitcoin-analysis
   ```

2. Install dependencies:
   ```
   npm install
   # or
   yarn install
   ```

3. Configure environment variables:
   Create a `.env.local` file in the root directory with your Snowflake credentials:
   ```
   SNOWFLAKE_ACCOUNT=your_account
   SNOWFLAKE_USERNAME=your_username
   SNOWFLAKE_PASSWORD=your_password
   SNOWFLAKE_WAREHOUSE=your_warehouse
   SNOWFLAKE_ROLE=your_role
   SNOWFLAKE_DATABASE_ONCHAIN=bitcoin_onchain_core_data
   SNOWFLAKE_SCHEMA_ONCHAIN=core
   SNOWFLAKE_DATABASE_METRICS=BTC_DATA
   SNOWFLAKE_SCHEMA_METRICS=DATA
   ```

4. Start the development server:
   ```
   npm run dev
   # or
   yarn dev
   ```

5. Open your browser and navigate to http://localhost:3000

### Building for Production

```
npm run build
npm start
# or
yarn build
yarn start
```

## Project Structure

```
bitcoin-analysis/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes
│   │   │   ├── blocks/         # Block-related API endpoints
│   │   │   ├── transactions/   # Transaction-related API endpoints
│   │   │   └── metrics/        # On-chain metrics API endpoints
│   │   ├── blocks/             # Block explorer pages
│   │   ├── transactions/       # Transaction explorer pages
│   │   ├── analytics/          # Charts pages
│   │   ├── layout.tsx          # App layout
│   │   ├── page.tsx            # Homepage
│   │   └── globals.css         # Global styles
│   ├── components/             # React components
│   │   ├── layout/             # Layout components (Header, Footer)
│   │   └── ui/                 # UI components (Card, Chart, etc.)
│   ├── lib/                    # Utility functions
│   │   ├── db/                 # Database utilities
│   │   │   └── snowflake.ts    # Snowflake connection
│   │   └── types.ts            # TypeScript types
│   └── utils/                  # Helper utilities
├── public/                     # Static assets
├── .env.local                  # Environment variables (not committed)
├── package.json                # Project dependencies
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.js          # Tailwind CSS configuration
└── README.md                   # Project documentation
```

## Example SQL Queries

Here are some example SQL queries used in the application:

### Fetching Latest Blocks

```sql
SELECT * 
FROM FACT_BLOCKS 
ORDER BY BLOCK_NUMBER DESC 
LIMIT 50
```

### Fetching Transaction Details

```sql
SELECT * 
FROM FACT_TRANSACTIONS 
WHERE TX_ID = 'transaction_id_here'
```

### Getting Hash Rate Data

```sql
SELECT DATE, HASH_RATE
FROM HASH_RATE
WHERE DATE BETWEEN '2023-01-01' AND '2023-12-31'
ORDER BY DATE
```

## Development Notes

### TypeScript Type Declarations

This project uses TypeScript for type safety. Custom type declarations for external modules are located in `src/types/declarations.d.ts`. If you encounter TypeScript errors related to missing modules, you may need to:

1. Install the dependencies:
   ```
   npm install
   ```

2. If you're using Windows PowerShell and encounter execution policy errors, you can try:
   ```
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   npm install
   ```

3. Or alternatively, use Command Prompt/Git Bash instead of PowerShell.

If you still face TypeScript errors after installation, the declarations file should help TypeScript understand the modules. The application should still run despite these warnings.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Bitcoin data is provided for informational purposes only, not financial advice
- This project uses Snowflake for data storage and querying 