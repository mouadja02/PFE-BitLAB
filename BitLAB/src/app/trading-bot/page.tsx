"use client";

import React from 'react';
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Send, Bot, User, Bitcoin } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  typing?: boolean;
}

export default function BitcoinChatBot() {
  // Generate a numeric session ID that persists for the browser session (max 12 digits)
  const [sessionId, setSessionId] = React.useState<number | null>(null);

  React.useEffect(() => {
    // This runs only on the client side
    const initializeSessionId = () => {
      // Try to get existing session ID from sessionStorage
      const existingSessionId = sessionStorage.getItem('bitbot-session-id');
      if (existingSessionId) {
        const parsedId = parseInt(existingSessionId);
        if (!isNaN(parsedId)) {
          setSessionId(parsedId);
          return;
        }
      }
      
      // Generate new numeric session ID (max 12 digits)
      // Use timestamp (13 digits) and take last 10 digits, then add 2 random digits
      const timestamp = Date.now().toString();
      const timestampPart = timestamp.slice(-10); // Last 10 digits of timestamp
      const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 2 random digits
      const newSessionId = parseInt(timestampPart + randomPart);
      
      sessionStorage.setItem('bitbot-session-id', newSessionId.toString());
      setSessionId(newSessionId);
    };

    initializeSessionId();
  }, []);

  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: '1',
      content: "👋 Hey there! I'm BitBot, your AI-powered Bitcoin assistant connected to advanced analytics workflows.\n\nI can help you with:\n- **Bitcoin analysis** and market insights\n- **Trading strategies** and technical indicators  \n- **On-chain data** and network metrics\n- **Educational content** about Bitcoin fundamentals\n\nI support full **Markdown formatting** including code blocks, lists, links, and more!\n\nWhat would you like to know about Bitcoin today?",
      sender: 'bot',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);



  const getBotResponse = async (userMessage: string): Promise<string> => {
    try {
      console.log('Sending request with sessionId:', { sessionId, type: typeof sessionId });
      
      // Don't send request if sessionId is not ready yet
      if (sessionId === null) {
        return "🤖 Please wait a moment while I initialize...";
      }
      
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: sessionId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Chatbot API error:', errorData);
        return "🤖 Sorry, I'm having trouble connecting to my brain right now. Please try again in a moment!";
      }

      const data = await response.json();
      
      // Ensure we always return a string
      let message = data.message || data.response || data.output;
      
      if (typeof message !== 'string') {
        if (message && typeof message === 'object') {
          // Try to extract text from object
          message = message.message || message.response || message.text || JSON.stringify(message);
        } else {
          message = "🤖 I received your message but couldn't generate a proper response. Please try rephrasing your question.";
        }
      }
      
      return message;
      
    } catch (error) {
      console.error('Error calling chatbot API:', error);
      return "🤖 I'm experiencing some technical difficulties. Please check your connection and try again!";
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    // Don't send message if session ID is not ready yet
    if (sessionId === null) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    const messageToSend = inputValue; // Store the message before clearing input
    setMessages((prev: Message[]) => [...prev, userMessage]);
    setInputValue('');
    
    // Show typing indicator
    setIsTyping(true);
    
    try {
      // Get response from n8n via our API
      const botResponseContent = await getBotResponse(messageToSend);
      
      // Stop typing indicator
      setIsTyping(false);
      
      // Add bot response
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: botResponseContent,
        sender: 'bot',
        timestamp: new Date(),
      };
      
      setMessages((prev: Message[]) => [...prev, botResponse]);
      
    } catch (error) {
      console.error('Error handling message:', error);
      setIsTyping(false);
      
      // Add error message
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "🤖 Sorry, I encountered an error processing your message. Please try again!",
        sender: 'bot',
        timestamp: new Date(),
      };
      
      setMessages((prev: Message[]) => [...prev, errorResponse]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickPrompts = [
    "What's Bitcoin's current market sentiment?",
    "Analyze Bitcoin's on-chain metrics",
    "Should I buy Bitcoin now?",
    "Explain Bitcoin halving cycles",
    "Show me Bitcoin fear & greed index"
  ];

  return (
    <div className="h-screen bg-gradient-to-br from-bitcoin-dark via-gray-900 to-black flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 text-center py-4 px-4 border-b border-bitcoin-orange/20">
        <div className="flex items-center justify-center mb-2">
          <div className="p-2 bg-bitcoin-orange rounded-full mr-3">
            <Bitcoin className="w-6 h-6 text-white" />
                </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-bitcoin-orange to-yellow-400 bg-clip-text text-transparent">
            BitBot
          </h1>
                    </div>
        <p className="text-sm text-gray-300">
          Your specialized Bitcoin AI assistant. Get real-time market insights, on-chain analysis, and trading guidance.
                      </p>
              </div>

      {/* Chat Container - Full Height */}
      <div className="flex-1 flex flex-col bg-bitcoin-dark/50 backdrop-blur-sm overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${
                  message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.sender === 'user' 
                    ? 'bg-blue-500' 
                    : 'bg-bitcoin-orange'
                }`}>
                  {message.sender === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
              </div>

                {/* Message Bubble */}
                <div className={`max-w-[70%] ${
                  message.sender === 'user' ? 'text-right' : 'text-left'
                }`}>
                                    <div className={`inline-block p-4 rounded-2xl ${
                    message.sender === 'user'
                      ? 'bg-blue-500 text-white rounded-tr-sm'
                      : 'bg-gray-700 text-gray-100 rounded-tl-sm'
                  }`}>
                    {message.sender === 'bot' ? (
                      <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                                                    components={{
                            // Custom styling for markdown elements
                            p: ({ children }: { children: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
                            h1: ({ children }: { children: React.ReactNode }) => <h1 className="text-lg font-bold mb-2 text-bitcoin-orange">{children}</h1>,
                            h2: ({ children }: { children: React.ReactNode }) => <h2 className="text-base font-bold mb-2 text-bitcoin-orange">{children}</h2>,
                            h3: ({ children }: { children: React.ReactNode }) => <h3 className="text-sm font-bold mb-1 text-bitcoin-orange">{children}</h3>,
                            ul: ({ children }: { children: React.ReactNode }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }: { children: React.ReactNode }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                            li: ({ children }: { children: React.ReactNode }) => <li className="text-gray-200">{children}</li>,
                            code: ({ children, className }: { children: React.ReactNode; className?: string }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-gray-600 text-bitcoin-orange px-1 py-0.5 rounded text-xs font-mono">
                                  {children}
                                </code>
                              ) : (
                                <code className={className}>{children}</code>
                              );
                            },
                            pre: ({ children }: { children: React.ReactNode }) => (
                              <pre className="bg-gray-800 border border-gray-600 rounded p-3 overflow-x-auto mb-2">
                                {children}
                              </pre>
                            ),
                            blockquote: ({ children }: { children: React.ReactNode }) => (
                              <blockquote className="border-l-4 border-bitcoin-orange pl-4 italic text-gray-300 mb-2">
                                {children}
                              </blockquote>
                            ),
                            a: ({ children, href }: { children: React.ReactNode; href?: string }) => (
                              <a 
                                href={href} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-bitcoin-orange hover:text-yellow-400 underline"
                              >
                                {children}
                              </a>
                            ),
                            strong: ({ children }: { children: React.ReactNode }) => <strong className="font-bold text-white">{children}</strong>,
                            em: ({ children }: { children: React.ReactNode }) => <em className="italic text-gray-300">{children}</em>,
                          }}
                        >
                          {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
                        </ReactMarkdown>
              </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
                      </p>
                    )}
                </div>
                  <p className="text-xs text-gray-400 mt-1 px-2">
                    {message.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                      </p>
                    </div>
                  </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-bitcoin-orange flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                  </div>
                <div className="bg-gray-700 rounded-2xl rounded-tl-sm p-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
                        
            <div ref={messagesEndRef} />
                        </div>
                      </div>

        {/* Quick Prompts */}
        {messages.length === 1 && (
          <div className="flex-shrink-0 px-6 pb-4">
            <div className="max-w-4xl mx-auto">
              <p className="text-sm text-gray-400 mb-3">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => setInputValue(prompt)}
                    className="text-xs px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
                    </div>
                  </div>
                </div>
        )}

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-gray-700 p-4">
          <div className="flex space-x-3 max-w-4xl mx-auto">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about Bitcoin..."
              className="flex-1 bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-bitcoin-orange focus:ring-bitcoin-orange/20"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping || sessionId === null}
              className="bg-bitcoin-orange hover:bg-bitcoin-orange/80 text-white px-6"
            >
              {isTyping ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
                </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            BitBot can make mistakes. This is for educational purposes only - not financial advice.
          </p>
                </div>
              </div>
    </div>
  );
} 