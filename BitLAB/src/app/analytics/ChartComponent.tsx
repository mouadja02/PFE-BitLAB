"use client";

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Define the props for our component
interface ChartComponentProps {
  data: any;
  options: any;
}

// Create the component that wraps react-chartjs-2's Line component
const ChartComponent: React.FC<ChartComponentProps> = ({ data, options }) => {
  return <Line data={data} options={options} />;
};

// Export the component as default
export default ChartComponent; 