import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { parseCsvData } from '@/lib/utils/csv-parser';

export async function GET() {
  try {
    // Path to data.csv file in the project root
    const dataPath = path.join(process.cwd(), 'data.csv');
    
    // Read the CSV file
    const csvData = await fs.readFile(dataPath, 'utf8');
    
    // Parse the CSV data
    const parsedData = parseCsvData(csvData);
    
    // Return the parsed data as JSON
    return NextResponse.json(parsedData);
  } catch (error) {
    console.error('Error reading Bitcoin data:', error);
    return NextResponse.json(
      { error: 'Failed to load Bitcoin data' },
      { status: 500 }
    );
  }
} 