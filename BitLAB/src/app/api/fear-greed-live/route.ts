import { NextResponse } from 'next/server';

interface FearGreedAPIResponse {
  name: string;
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update?: string;
  }>;
  metadata: {
    error: null | string;
  };
}

export async function GET() {
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=10');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Fear & Greed data: ${response.status}`);
    }
    
    const data: FearGreedAPIResponse = await response.json();
    
    if (data.metadata.error) {
      throw new Error(`API Error: ${data.metadata.error}`);
    }
    
    // Extract current, yesterday, and last week values
    const currentValue = data.data[0] ? parseInt(data.data[0].value) : 50;
    const yesterdayValue = data.data[1] ? parseInt(data.data[1].value) : 48;
    const lastWeekValue = data.data[7] ? parseInt(data.data[7].value) : 60;
    const currentClass = data.data[0] ? data.data[0].value_classification : 'Neutral';
    
    const result = {
      currentValue,
      yesterdayValue,
      lastWeekValue,
      currentClass,
      rawData: data.data
    };
    
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error fetching Fear & Greed data:', error);
    
    // Return fallback data
    const fallbackData = {
      currentValue: 50,
      yesterdayValue: 48,
      lastWeekValue: 60,
      currentClass: 'Neutral',
      rawData: []
    };
    
    return NextResponse.json(fallbackData, { status: 206 });
  }
} 