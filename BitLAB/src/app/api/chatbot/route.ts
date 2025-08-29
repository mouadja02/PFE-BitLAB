import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { message, sessionId } = await request.json();

    console.log('Received request:', { message: message?.substring(0, 50) + '...', sessionId, sessionIdType: typeof sessionId });

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // More flexible session ID validation - accept numbers or numeric strings
    const numericSessionId = typeof sessionId === 'string' ? parseInt(sessionId) : sessionId;
    
    if (!sessionId || (typeof sessionId !== 'number' && typeof sessionId !== 'string') || isNaN(numericSessionId)) {
      console.log('Invalid session ID:', { sessionId, type: typeof sessionId, parsed: numericSessionId });
      return NextResponse.json({ error: 'Valid numeric session ID is required' }, { status: 400 });
    }

    // Get the n8n webhook URL from environment variables
    const webhookUrl = process.env.N8N_CHATBOT_WEBHOOK;

    if (!webhookUrl) {
      console.error('N8N_CHATBOT_WEBHOOK environment variable is not set');
      return NextResponse.json({ 
        error: 'Chatbot service is not configured. Please contact administrator.' 
      }, { status: 500 });
    }

    // Send request to n8n webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        sessionId: numericSessionId
      }),
    });

    if (!response.ok) {
      console.error('N8N webhook request failed:', response.status, response.statusText);
      return NextResponse.json({ 
        error: 'Failed to get response from chatbot service' 
      }, { status: 500 });
    }

    const botResponse = await response.json();

    // Handle different N8N response formats
    let responseMessage = '';
    
    if (typeof botResponse === 'string') {
      responseMessage = botResponse;
    } else if (botResponse.message) {
      responseMessage = botResponse.message;
    } else if (botResponse.response) {
      responseMessage = botResponse.response;
    } else if (botResponse.output) {
      // Handle N8N output format
      if (typeof botResponse.output === 'string') {
        responseMessage = botResponse.output;
      } else if (botResponse.output.message) {
        responseMessage = botResponse.output.message;
      } else if (botResponse.output.response) {
        responseMessage = botResponse.output.response;
      } else {
        // If output is an object, try to extract meaningful text
        responseMessage = JSON.stringify(botResponse.output);
      }
    } else if (Array.isArray(botResponse) && botResponse.length > 0) {
      // Handle array responses (sometimes N8N returns arrays)
      const firstItem = botResponse[0];
      if (typeof firstItem === 'string') {
        responseMessage = firstItem;
      } else if (firstItem.message) {
        responseMessage = firstItem.message;
      } else if (firstItem.response) {
        responseMessage = firstItem.response;
      } else if (firstItem.output) {
        responseMessage = typeof firstItem.output === 'string' ? firstItem.output : JSON.stringify(firstItem.output);
      } else {
        responseMessage = JSON.stringify(firstItem);
      }
    } else {
      // Fallback: convert entire response to string
      responseMessage = JSON.stringify(botResponse);
    }

    // Ensure we have a valid string response
    if (!responseMessage || typeof responseMessage !== 'string') {
      responseMessage = "🤖 I received a response but couldn't parse it properly. Please try asking your question differently.";
    }

    // Return the response from n8n
    return NextResponse.json({
      message: responseMessage,
      success: true
    });

  } catch (error) {
    console.error('Chatbot API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}