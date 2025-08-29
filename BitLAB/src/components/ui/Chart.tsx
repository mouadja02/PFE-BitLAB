"use client";

import React from 'react';
import ChartJS from 'chart.js/auto';
import { Line, Bar } from 'react-chartjs-2';
import { Card } from './Card';

interface ChartProps {
  title?: string;
  type: 'line' | 'bar';
  data: any;
  options?: any;
  height?: number;
  className?: string;
}

export function Chart({ title, type, data, options, height = 300, className }: ChartProps) {
  // Set Chart.js defaults when component mounts
  React.useEffect(() => {
    try {
      if (ChartJS.defaults?.font) {
        ChartJS.defaults.font.family = "'Inter', 'Helvetica', 'Arial', sans-serif";
      }
      if (ChartJS.defaults) {
        ChartJS.defaults.color = '#9ca3af';
      }
    } catch (error) {
      console.warn('Unable to set Chart.js defaults:', error);
    }
  }, []);

  // Basic options that work with TypeScript
  const defaultOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: !!title,
        text: title || '',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    hover: {
      mode: 'nearest',
      intersect: true,
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 0,
        },
      },
      y: {
        beginAtZero: type === 'bar',
      },
    },
  };

  const mergedOptions = { ...defaultOptions, ...options };

  const chartContent = (
    <div style={{ height }} className="animate-fade-in">
      {type === 'line' ? (
        <Line data={data} options={mergedOptions} />
      ) : (
        <Bar data={data} options={mergedOptions} />
      )}
    </div>
  );

  return (
    <Card className={className}>
      {chartContent}
    </Card>
  );
}

export function formatChartData(
  labels: string[],
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
  }>
): any {
  return {
    labels,
    datasets: datasets.map((dataset) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: dataset.borderColor || '#F7931A',
      backgroundColor: dataset.backgroundColor || 'rgba(247, 147, 26, 0.5)',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointBackgroundColor: dataset.borderColor || '#F7931A',
      pointBorderColor: '#fff',
      pointBorderWidth: 1,
      pointHitRadius: 10,
    })),
  };
} 