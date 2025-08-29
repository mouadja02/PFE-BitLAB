// React
declare module 'react' {
  export * from 'react';
  export default React;
}

// Next.js modules
declare module 'next/link';
declare module 'next/navigation';
declare module 'next/server';
declare module 'next';

// UI and styling
declare module 'clsx';
declare module 'lucide-react';

// Charts
declare module 'chart.js' {
  export interface ResponsiveContainerProps {
    labels?: any[];
    datasets: ChartDataset[];
  }

  export interface ChartOptions {
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    plugins?: {
      legend?: {
        position?: 'top' | 'bottom' | 'left' | 'right';
      };
      title?: {
        display?: boolean;
        text?: string;
      };
      tooltip?: {
        mode?: 'index' | 'point' | 'nearest' | 'dataset' | 'x' | 'y';
        intersect?: boolean;
      };
    };
    hover?: {
      mode?: 'index' | 'point' | 'nearest' | 'dataset' | 'x' | 'y';
      intersect?: boolean;
    };
    scales?: {
      x?: {
        ticks?: {
          maxRotation?: number;
        };
      };
      y?: any;
    };
  }

  export interface ChartDataset {
    label?: string;
    data: any[];
    borderColor?: string | string[];
    backgroundColor?: string | string[];
    borderWidth?: number;
    tension?: number;
  }

  export const Chart: any;
  export const CategoryScale: any;
  export const LinearScale: any;
  export const PointElement: any;
  export const LineElement: any;
  export const BarElement: any;
  export const Title: any;
  export const Tooltip: any;
  export const Legend: any;
}

declare module 'react-chartjs-2';

// Date formatting
declare module 'date-fns';

// Database
declare module 'snowflake-sdk' {
  export interface Connection {
    connect: (callback: (err: any, conn: any) => void) => void;
    execute: (options: {
      sqlText: string;
      binds?: any[];
      complete: (err: any, stmt: any, rows: any) => void;
    }) => any;
    destroy: (callback: (err: any) => void) => void;
  }
  
  export function createConnection(options: {
    account: string;
    username: string;
    password: string;
    warehouse?: string;
    database?: string;
    schema?: string;
    role?: string;
  }): Connection;
}

// Global process
declare namespace NodeJS {
  interface ProcessEnv {
    SNOWFLAKE_ACCOUNT: string;
    SNOWFLAKE_USERNAME: string;
    SNOWFLAKE_PASSWORD: string;
    SNOWFLAKE_WAREHOUSE: string;
    SNOWFLAKE_ROLE: string;
    SNOWFLAKE_DATABASE_ONCHAIN: string;
    SNOWFLAKE_SCHEMA_ONCHAIN: string;
    SNOWFLAKE_DATABASE_METRICS: string;
    SNOWFLAKE_SCHEMA_METRICS: string;
    [key: string]: string | undefined;
  }
}

// For JSX
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
} 