'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Search, ArrowRight, Database, ChevronDown, ChevronUp, Download, Bitcoin } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';

// Types for blockchain data
interface Block {
  BLOCK_NUMBER: number;
  BLOCK_HASH: string;
  BLOCK_TIMESTAMP: string;
  TX_COUNT: number;
  SIZE: number;
  DIFFICULTY: number;
  MERKLE_ROOT?: string;
  PREVIOUS_BLOCK_HASH?: string;
  NEXT_BLOCK_HASH?: string;
  STRIPPED_SIZE?: number;
  WEIGHT?: string | number;
  VERSION?: string | number;
  BITS?: string;
  NONCE?: number;
  CHAINWORK?: string;
  MEDIAN_TIME?: string;
  INSERTED_TIMESTAMP?: string;
  MODIFIED_TIMESTAMP?: string;
}

interface Transaction {
  TX_ID: string;
  TX_HASH: string;
  BLOCK_NUMBER: number;
  BLOCK_TIMESTAMP: string;
  BLOCK_HASH?: string;
  FEE: number;
  INPUT_COUNT: number;
  OUTPUT_COUNT: number;
  INPUT_VALUE: number;
  INPUT_VALUE_SATS?: number;
  OUTPUT_VALUE: number;
  OUTPUT_VALUE_SATS?: number;
  IS_COINBASE: boolean;
  COINBASE?: string;
  SIZE?: number;
  VIRTUAL_SIZE?: string;
  WEIGHT?: string | number;
  LOCK_TIME?: string;
  VERSION?: number;
  HEX?: string;
  INPUTS?: any[]; // JSON array if available
  OUTPUTS?: any[]; // JSON array if available
  INSERTED_TIMESTAMP?: string;
  MODIFIED_TIMESTAMP?: string;
}

interface Output {
  TX_ID: string;
  INDEX: number;
  VALUE: number;
  VALUE_SATS?: number;
  PUBKEY_SCRIPT_ADDRESS: string;
  PUBKEY_SCRIPT_TYPE: string;
  PUBKEY_SCRIPT_DESC?: string;
  PUBKEY_SCRIPT_ASM?: string;
  PUBKEY_SCRIPT_HEX?: string;
  OUTPUT_ID?: string;
}

interface Input {
  TX_ID: string;
  INDEX: number;
  VALUE: number;
  VALUE_SATS?: number;
  PUBKEY_SCRIPT_ADDRESS: string;
  SPENT_TX_ID: string;
  SPENT_OUTPUT_INDEX?: number;
  IS_COINBASE?: boolean;
  COINBASE?: string;
  SCRIPT_SIG_ASM?: string;
  SCRIPT_SIG_HEX?: string;
  SEQUENCE?: number;
  TX_IN_WITNESS?: any[];
  INPUT_ID?: string;
}

interface Address {
  ADDRESS: string;
  PROJECT_NAME: string | null;
  ADDRESS_GROUP: number | null;
}

type SearchType = 'block' | 'transaction' | 'address';
type ViewMode = 'overview' | 'raw';

export default function BlockExplorer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchType, setSearchType] = React.useState<SearchType>('block');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Data states
  const [latestBlocks, setLatestBlocks] = React.useState<Block[]>([]);
  const [currentBlock, setCurrentBlock] = React.useState<Block | null>(null);
  const [currentTransaction, setCurrentTransaction] = React.useState<Transaction | null>(null);
  const [currentAddress, setCurrentAddress] = React.useState<Address | null>(null);
  const [transactionsForBlock, setTransactionsForBlock] = React.useState<Transaction[]>([]);
  const [transactionsForAddress, setTransactionsForAddress] = React.useState<Transaction[]>([]);
  const [inputsForTransaction, setInputsForTransaction] = React.useState<Input[]>([]);
  const [outputsForTransaction, setOutputsForTransaction] = React.useState<Output[]>([]);
  
  // View mode states
  const [blockViewMode, setBlockViewMode] = React.useState<ViewMode>('overview');
  const [txListViewMode, setTxListViewMode] = React.useState<ViewMode>('overview');
  const [txDetailsViewMode, setTxDetailsViewMode] = React.useState<ViewMode>('overview');
  const [inputsViewMode, setInputsViewMode] = React.useState<ViewMode>('overview');
  const [outputsViewMode, setOutputsViewMode] = React.useState<ViewMode>('overview');
  const [selectedTransactionForTxList, setSelectedTransactionForTxList] = React.useState<string | null>(null);
  
  // UI states
  const [showTransactionDetails, setShowTransactionDetails] = React.useState(false);

  // Fetch latest blocks on component mount and check URL parameters
  React.useEffect(() => {
    fetchLatestBlocks();
    
    // Check if we have URL parameters for direct navigation
    const type = searchParams.get('type') as SearchType | null;
    const query = searchParams.get('query');
    
    if (query) {
      setSearchQuery(query);
      if (type) {
        setSearchType(type);
      } else {
        // Auto-detect search type
        setSearchType(detectSearchType(query));
      }
      
      // Trigger the search
      handleSearchWithParams(query, type || detectSearchType(query));
    }
  }, [searchParams]);

  // Function to fetch latest blocks
  const fetchLatestBlocks = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/blockchain/latest-blocks');
      
      if (!response.ok) {
        throw new Error('Failed to fetch latest blocks');
      }
      
      const data = await response.json();
      setLatestBlocks(data);
    } catch (err) {
      console.error('Error fetching latest blocks:', err);
      setError('Failed to load latest blocks. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle search from URL parameters
  const handleSearchWithParams = async (query: string, type: SearchType) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    // Reset all current data
    setCurrentBlock(null);
    setCurrentTransaction(null);
    setCurrentAddress(null);
    setTransactionsForBlock([]);
    setTransactionsForAddress([]);
    setInputsForTransaction([]);
    setOutputsForTransaction([]);
    setShowTransactionDetails(false);
    setSelectedTransactionForTxList(null);
    
    try {
      if (/^\d+$/.test(query)) {
        // Numeric search - likely a block number
        await fetchBlockByNumber(parseInt(query));
      } else {
        // Non-numeric search - could be block hash, txid, or address
        if (type === 'block') {
          const blockResult = await tryFetchBlockByHash(query);
          if (!blockResult) {
            setError(`Block not found: ${query}`);
          }
        } else if (type === 'transaction') {
          const txResult = await tryFetchTransactionById(query);
          if (!txResult) {
            setError(`Transaction not found: ${query}`);
          }
        } else if (type === 'address') {
          const addressResult = await tryFetchAddressByHash(query);
          if (!addressResult) {
            setError(`Address not found: ${query}`);
          }
        }
      }
    } catch (err) {
      console.error('Error searching blockchain data:', err);
      setError(`Failed to find ${type}: ${query}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to fetch block by number
  const fetchBlockByNumber = async (blockNumber: number) => {
    const endpoint = `/api/blockchain/block-by-number/${blockNumber}`;
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      throw new Error(`Block not found: ${blockNumber}`);
    }
    
    const blockData = await response.json();
    setCurrentBlock(blockData);
    
    // Also fetch transactions for this block
    await fetchTransactionsForBlock(blockData.BLOCK_NUMBER);
    
    return true;
  };
  
  // Helper function to try fetching a block by hash
  const tryFetchBlockByHash = async (hash: string) => {
    try {
      const endpoint = `/api/blockchain/block-by-hash/${hash}`;
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        return false;
      }
      
      const blockData = await response.json();
      setCurrentBlock(blockData);
      
      // Also fetch transactions for this block
      await fetchTransactionsForBlock(blockData.BLOCK_NUMBER);
      
      return true;
    } catch (error) {
      return false;
    }
  };
  
  // Helper function to try fetching a transaction by id
  const tryFetchTransactionById = async (txid: string) => {
    try {
      const endpoint = `/api/blockchain/transaction/${txid}`;
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        return false;
      }
      
      const txData = await response.json();
      setCurrentTransaction(txData);
      setShowTransactionDetails(true);
      
      // Also fetch inputs and outputs for this transaction
      await fetchInputsAndOutputsForTransaction(txid);
      
      return true;
    } catch (error) {
      return false;
    }
  };
  
  // Helper function to try fetching an address
  const tryFetchAddressByHash = async (address: string) => {
    try {
      const endpoint = `/api/blockchain/address/${address}`;
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        return false;
      }
      
      const addressData = await response.json();
      setCurrentAddress(addressData);
      
      // Also fetch transactions for this address
      await fetchTransactionsForAddress(address);
      
      return true;
    } catch (error) {
      return false;
    }
  };
  
  // Helper function to fetch transactions for a block
  const fetchTransactionsForBlock = async (blockNumber: number) => {
    const txsResponse = await fetch(`/api/blockchain/transactions-for-block/${blockNumber}`);
    
    if (txsResponse.ok) {
      const txsData = await txsResponse.json();
      setTransactionsForBlock(txsData);
    }
  };
  
  // Helper function to fetch inputs and outputs for a transaction
  const fetchInputsAndOutputsForTransaction = async (txid: string) => {
    const inputsResponse = await fetch(`/api/blockchain/inputs-for-transaction/${txid}`);
    const outputsResponse = await fetch(`/api/blockchain/outputs-for-transaction/${txid}`);
    
    if (inputsResponse.ok) {
      const inputsData = await inputsResponse.json();
      setInputsForTransaction(inputsData);
    }
    
    if (outputsResponse.ok) {
      const outputsData = await outputsResponse.json();
      setOutputsForTransaction(outputsData);
    }
  };
  
  // Helper function to fetch transactions for an address
  const fetchTransactionsForAddress = async (address: string) => {
    const addressTxsResponse = await fetch(`/api/blockchain/transactions-for-address/${address}`);
    
    if (addressTxsResponse.ok) {
      const addressTxsData = await addressTxsResponse.json();
      setTransactionsForAddress(addressTxsData);
    }
  };

  const detectSearchType = (query: string) => {
    // Detect if it's a block number, block hash, transaction ID, or address
    if (/^[0-9]+$/.test(query)) {
      return 'block'; // Numeric - likely a block number
    } else if (/^[0-9a-f]{64}$/i.test(query)) {
      return 'transaction'; // 64 hex chars - likely a transaction ID or block hash
    } else if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(query) || 
               /^bc1[ac-hj-np-z02-9]{39,59}$/.test(query)) {
      return 'address'; // Likely a Bitcoin address
    }
    return 'block'; // Default
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Automatically detect the search type based on input format
    if (query) {
      setSearchType(detectSearchType(query));
    }
  };

  // View a specific transaction from a list with URL update
  const viewTransactionDetails = async (txId: string) => {
    // Update URL
    router.push(`/block-explorer?type=transaction&query=${encodeURIComponent(txId)}`);
    
    setIsLoading(true);
    setError(null);
    setSelectedTransactionForTxList(txId);
    
    try {
      const endpoint = `/api/blockchain/transaction/${txId}`;
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`Transaction not found: ${txId}`);
      }
      
      const txData = await response.json();
      setCurrentTransaction(txData);
      setShowTransactionDetails(true);
      
      // Also fetch inputs and outputs
      await fetchInputsAndOutputsForTransaction(txId);
    } catch (err) {
      console.error('Error fetching transaction details:', err);
      setError(`Failed to fetch transaction details for: ${txId}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  // Format BTC value
  const formatBtcValue = (value: number) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(8)} BTC`;
  };
  
  // Format Satoshi value
  const formatSatsValue = (value: number) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toLocaleString()} sats`;
  };
  
  // Toggle view mode for different sections
  const toggleBlockViewMode = () => setBlockViewMode(blockViewMode === 'overview' ? 'raw' : 'overview');
  const toggleTxListViewMode = () => setTxListViewMode(txListViewMode === 'overview' ? 'raw' : 'overview');
  const toggleTxDetailsViewMode = () => setTxDetailsViewMode(txDetailsViewMode === 'overview' ? 'raw' : 'overview');
  const toggleInputsViewMode = () => setInputsViewMode(inputsViewMode === 'overview' ? 'raw' : 'overview');
  const toggleOutputsViewMode = () => setOutputsViewMode(outputsViewMode === 'overview' ? 'raw' : 'overview');
  
  // Convert object to JSON for display
  const toJSON = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return 'Error converting to JSON';
    }
  };
  
  // Download data as JSON file
  const downloadJSON = (data: any, filename: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Function to render transaction details
  const renderTransactionDetails = () => {
    if (!currentTransaction) return null;
    
    // Calculate fee in sats
    const feeBtc = currentTransaction.FEE || 0;
    const feeSats = Math.round(feeBtc * 100000000);
    
    return (
      <>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xl font-semibold text-white">Transaction</h3>
          <div className="flex gap-2">
            <button 
              onClick={toggleTxDetailsViewMode}
              className="text-bitcoin-orange hover:underline flex items-center"
            >
              {txDetailsViewMode === 'overview' ? 'Show Raw' : 'Show Overview'}
              {txDetailsViewMode === 'overview' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
            <button
              onClick={() => downloadJSON(currentTransaction, `tx-${currentTransaction.TX_ID}.json`)}
              className="text-bitcoin-orange hover:underline flex items-center"
              title="Download as JSON"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
        
        {txDetailsViewMode === 'overview' ? (
          <div className="bg-white/5 p-4 rounded-lg">
            <div className="space-y-2">
              <div>
                <span className="text-gray-400">Transaction ID:</span>
                <p className="text-white break-all font-mono text-sm">{currentTransaction.TX_ID}</p>
              </div>
              {currentTransaction?.TX_HASH && currentTransaction?.TX_HASH !== currentTransaction?.TX_ID && (
                <div className="flex flex-col space-y-1 mb-3">
                  <p className="text-gray-400 text-xs">Transaction Hash:</p>
                  <p className="text-white break-all font-mono text-sm">{currentTransaction?.TX_HASH}</p>
                </div>
              )}
              <div>
                <span className="text-gray-400">Block:</span>
                <span
                  onClick={() => {
                    setSearchQuery(currentTransaction.BLOCK_NUMBER.toString());
                    setSearchType('block');
                    handleSearchWithParams(currentTransaction.BLOCK_NUMBER.toString(), 'block');
                  }}
                  className="text-bitcoin-orange hover:underline cursor-pointer ml-2"
                >
                  {currentTransaction.BLOCK_NUMBER}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Time:</span>
                <p className="text-white">{formatTimestamp(currentTransaction.BLOCK_TIMESTAMP)}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <span className="text-gray-400">Total Input:</span>
                  <p className="text-white">{formatBtcValue(currentTransaction.INPUT_VALUE)}</p>
                  {currentTransaction.INPUT_VALUE_SATS && (
                    <p className="text-gray-400 text-sm">{formatSatsValue(currentTransaction.INPUT_VALUE_SATS)}</p>
                  )}
                </div>
                <div>
                  <span className="text-gray-400">Total Output:</span>
                  <p className="text-white">{formatBtcValue(currentTransaction.OUTPUT_VALUE)}</p>
                  {currentTransaction.OUTPUT_VALUE_SATS && (
                    <p className="text-gray-400 text-sm">{formatSatsValue(currentTransaction.OUTPUT_VALUE_SATS)}</p>
                  )}
                </div>
                <div>
                  <span className="text-gray-400">Fee:</span>
                  <p className="text-white">
                    {currentTransaction.IS_COINBASE ? 'Coinbase (No Fee)' : formatBtcValue(currentTransaction.FEE)}
                  </p>
                  {!currentTransaction.IS_COINBASE && (
                    <p className="text-gray-400 text-sm">{feeSats.toLocaleString()} sats</p>
                  )}
                </div>
                <div>
                  <span className="text-gray-400">Status:</span>
                  <p className="text-green-500">Confirmed</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                  <span className="text-gray-400">Size:</span>
                  <p className="text-white">{currentTransaction.SIZE?.toLocaleString() || 'N/A'} bytes</p>
                </div>
                <div>
                  <span className="text-gray-400">Weight:</span>
                  <p className="text-white">{currentTransaction.WEIGHT || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Version:</span>
                  <p className="text-white">{currentTransaction.VERSION || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Lock Time:</span>
                  <p className="text-white">{currentTransaction.LOCK_TIME || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 p-4 rounded-lg">
            <pre className="text-white overflow-auto max-h-96 font-mono text-sm">
              {toJSON(currentTransaction)}
            </pre>
          </div>
        )}

        {/* INPUTS from JSON column if available */}
        {currentTransaction.INPUTS && Array.isArray(currentTransaction.INPUTS) && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-lg font-semibold text-white">Inputs from JSON ({currentTransaction.INPUTS.length})</h4>
              <div className="flex gap-2">
                <button 
                  onClick={toggleInputsViewMode}
                  className="text-bitcoin-orange hover:underline flex items-center"
                >
                  {inputsViewMode === 'overview' ? 'Show Raw' : 'Show Overview'}
                  {inputsViewMode === 'overview' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
            </div>
            
            <div className="bg-white/5 p-4 rounded-lg overflow-x-auto">
              {inputsViewMode === 'overview' ? (
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-2 text-left text-gray-400">TXID</th>
                      <th className="py-2 text-right text-gray-400">Vout</th>
                      <th className="py-2 text-left text-gray-400">ScriptSig</th>
                      <th className="py-2 text-right text-gray-400">Sequence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTransaction.INPUTS.map((input: any, index: number) => (
                      <tr key={index} className="border-b border-gray-800 hover:bg-white/10">
                        <td className="py-2 text-bitcoin-orange break-all font-mono text-sm">
                          {input.txid || 'N/A'}
                        </td>
                        <td className="py-2 text-right text-white">
                          {input.vout !== undefined ? input.vout : 'N/A'}
                        </td>
                        <td className="py-2 text-white font-mono text-sm truncate max-w-xs">
                          {input.scriptSig?.asm || 'N/A'}
                        </td>
                        <td className="py-2 text-right text-white">
                          {input.sequence || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <pre className="text-white overflow-auto max-h-96 font-mono text-sm">
                  {toJSON(currentTransaction.INPUTS)}
                </pre>
              )}
            </div>
          </div>
        )}
        
        {/* OUTPUTS from JSON column if available */}
        {currentTransaction.OUTPUTS && Array.isArray(currentTransaction.OUTPUTS) && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-lg font-semibold text-white">Outputs from JSON ({currentTransaction.OUTPUTS.length})</h4>
              <div className="flex gap-2">
                <button 
                  onClick={toggleOutputsViewMode}
                  className="text-bitcoin-orange hover:underline flex items-center"
                >
                  {outputsViewMode === 'overview' ? 'Show Raw' : 'Show Overview'}
                  {outputsViewMode === 'overview' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
            </div>
            
            <div className="bg-white/5 p-4 rounded-lg overflow-x-auto">
              {outputsViewMode === 'overview' ? (
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-2 text-left text-gray-400">Index</th>
                      <th className="py-2 text-right text-gray-400">Value</th>
                      <th className="py-2 text-left text-gray-400">Type</th>
                      <th className="py-2 text-left text-gray-400">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTransaction.OUTPUTS.map((output: any, index: number) => (
                      <tr key={index} className="border-b border-gray-800 hover:bg-white/10">
                        <td className="py-2 text-white">
                          {output.n !== undefined ? output.n : index}
                        </td>
                        <td className="py-2 text-right text-white">
                          {output.value !== undefined ? output.value : 'N/A'} BTC
                        </td>
                        <td className="py-2 text-white">
                          {output.scriptPubKey?.type || 'N/A'}
                        </td>
                        <td className="py-2 text-bitcoin-orange break-all font-mono text-sm">
                          {output.scriptPubKey?.address || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <pre className="text-white overflow-auto max-h-96 font-mono text-sm">
                  {toJSON(currentTransaction.OUTPUTS)}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Inputs and Outputs from separate tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          {/* Inputs */}
          <div>
            <h4 className="text-lg font-semibold mb-2 text-white">Inputs ({inputsForTransaction.length})</h4>
            <div className="bg-white/5 p-4 rounded-lg overflow-x-auto max-h-96">
              {currentTransaction.IS_COINBASE ? (
                <div className="text-gray-400">Coinbase (New Coins)</div>
              ) : inputsForTransaction.length > 0 ? (
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-2 text-left text-gray-400">Index</th>
                      <th className="py-2 text-left text-gray-400">Address</th>
                      <th className="py-2 text-right text-gray-400">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inputsForTransaction.map((input: Input) => (
                      <tr key={`${input.TX_ID}-${input.INDEX}`} className="border-b border-gray-800 hover:bg-white/10">
                        <td className="py-2 text-white">{input.INDEX}</td>
                        <td className="py-2">
                          {input.PUBKEY_SCRIPT_ADDRESS ? (
                            <span 
                              className="text-bitcoin-orange hover:underline cursor-pointer break-all"
                              onClick={() => {
                                setSearchQuery(input.PUBKEY_SCRIPT_ADDRESS);
                                setSearchType('address');
                                handleSearchWithParams(input.PUBKEY_SCRIPT_ADDRESS, 'address');
                              }}
                            >
                              {input.PUBKEY_SCRIPT_ADDRESS}
                            </span>
                          ) : (
                            <span className="text-gray-400">Unknown Address</span>
                          )}
                        </td>
                        <td className="py-2 text-right text-white">{formatBtcValue(input.VALUE)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-gray-400">No input data available</div>
              )}
            </div>
          </div>

          {/* Outputs */}
          <div>
            <h4 className="text-lg font-semibold mb-2 text-white">Outputs ({outputsForTransaction.length})</h4>
            <div className="bg-white/5 p-4 rounded-lg overflow-x-auto max-h-96">
              {outputsForTransaction.length > 0 ? (
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-2 text-left text-gray-400">Index</th>
                      <th className="py-2 text-left text-gray-400">Address</th>
                      <th className="py-2 text-right text-gray-400">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outputsForTransaction.map((output: Output) => (
                      <tr key={`${output.TX_ID}-${output.INDEX}`} className="border-b border-gray-800 hover:bg-white/10">
                        <td className="py-2 text-white">{output.INDEX}</td>
                        <td className="py-2">
                          {output.PUBKEY_SCRIPT_ADDRESS ? (
                            <span 
                              className="text-bitcoin-orange hover:underline cursor-pointer break-all"
                              onClick={() => {
                                setSearchQuery(output.PUBKEY_SCRIPT_ADDRESS);
                                setSearchType('address');
                                handleSearchWithParams(output.PUBKEY_SCRIPT_ADDRESS, 'address');
                              }}
                            >
                              {output.PUBKEY_SCRIPT_ADDRESS}
                            </span>
                          ) : (
                            <span className="text-gray-400">Unknown Address</span>
                          )}
                        </td>
                        <td className="py-2 text-right text-white">{formatBtcValue(output.VALUE)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-gray-400">No output data available</div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  // Update URL when searching manually
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    // Update URL with search parameters for bookmarking/sharing
    router.push(`/block-explorer?type=${searchType}&query=${encodeURIComponent(searchQuery)}`);
    
    // Call the shared search handler
    await handleSearchWithParams(searchQuery, searchType);
  };

  // For block selection in the horizontal navigation
  const handleBlockClick = (blockNumber: number) => {
    router.push(`/block-explorer?type=block&query=${blockNumber}`);
    setSearchQuery(blockNumber.toString());
    setSearchType('block');
    handleSearchWithParams(blockNumber.toString(), 'block');
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-6 border-b border-gray-800">
        <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
          <Bitcoin className="mr-2 text-bitcoin-orange" size={24} />
          Latest BTC Blocks
        </h2>
        
        {/* Search bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              placeholder="Search for block number, block hash, transaction ID, or address..."
              className="w-full p-3 pr-10 bg-white/5 border border-gray-700 rounded text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <div className="absolute right-3 top-3 text-gray-400">
              <Search size={20} />
            </div>
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-bitcoin-orange text-white rounded"
          >
            Search
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bitcoin-orange"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 p-4 border border-red-300 rounded bg-red-900/20 m-6">
          {error}
        </div>
      ) : (
        <div>
          {/* Horizontal block navigation */}
          {!currentBlock && !currentTransaction && !currentAddress && (
            <div className="px-6 py-4 overflow-x-auto">
              <div className="flex space-x-4 min-w-max">
                {latestBlocks.map((block: Block) => (
                  <div 
                    key={block.BLOCK_NUMBER}
                    className="flex flex-col items-center cursor-pointer"
                    onClick={() => handleBlockClick(block.BLOCK_NUMBER)}
                  >
                    <div className="w-16 h-16 rounded bg-gradient-to-br from-orange-200 to-orange-400 flex items-center justify-center hover:from-orange-300 hover:to-orange-500 transition-all">
                      <span className="text-xs text-gray-800 font-semibold">#{block.BLOCK_NUMBER}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Block Details View */}
          {currentBlock && (
            <div className="p-6">
              <div className="mb-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 flex items-center justify-center mr-4">
                      <Bitcoin size={28} color="#000" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Bitcoin Bloc {currentBlock.BLOCK_NUMBER}</h3>
                      <p className="text-gray-400">
                        Miné le {formatTimestamp(currentBlock.BLOCK_TIMESTAMP)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={toggleBlockViewMode}
                      className="text-bitcoin-orange hover:underline flex items-center"
                    >
                      {blockViewMode === 'overview' ? 'Show Raw' : 'Show Overview'}
                      {blockViewMode === 'overview' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                    <button
                      onClick={() => downloadJSON(currentBlock, `block-${currentBlock.BLOCK_NUMBER}.json`)}
                      className="text-bitcoin-orange hover:underline flex items-center"
                      title="Download as JSON"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {blockViewMode === 'overview' ? (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="bg-white/5 rounded-lg p-6">
                      <h4 className="text-lg font-semibold mb-4 text-white">Détails</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Hashage</span>
                          <span className="text-white font-mono text-sm break-all">{currentBlock.BLOCK_HASH.substring(0, 10)}...</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Capacité</span>
                          <span className="text-white">{currentBlock.SIZE?.toLocaleString()} bytes</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Distance</span>
                          <span className="text-white">{formatTimestamp(currentBlock.BLOCK_TIMESTAMP)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Transactions</span>
                          <span className="text-white">{currentBlock.TX_COUNT}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Version</span>
                          <span className="text-white">{currentBlock.VERSION || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Racine de Merkle</span>
                          <span className="text-white font-mono text-sm break-all">{currentBlock.MERKLE_ROOT?.substring(0, 10) || 'N/A'}...</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Difficulté</span>
                          <span className="text-white">{currentBlock.DIFFICULTY?.toLocaleString() || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Nonce</span>
                          <span className="text-white">{currentBlock.NONCE || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Bits</span>
                          <span className="text-white">{currentBlock.BITS || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white/5 rounded-lg p-6">
                      <h4 className="text-lg font-semibold mb-4 text-white">Détails additionnels</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Poids</span>
                          <span className="text-white">{currentBlock.WEIGHT || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Taille découpée</span>
                          <span className="text-white">{currentBlock.STRIPPED_SIZE?.toLocaleString() || 'N/A'} bytes</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Chaînework</span>
                          <span className="text-white font-mono text-sm">{currentBlock.CHAINWORK || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Hash précédent</span>
                          <span className="text-white font-mono text-sm break-all">{currentBlock.PREVIOUS_BLOCK_HASH?.substring(0, 10) || 'N/A'}...</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Hash suivant</span>
                          <span className="text-white font-mono text-sm break-all">{currentBlock.NEXT_BLOCK_HASH?.substring(0, 10) || 'N/A'}...</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Temps médian</span>
                          <span className="text-white">{formatTimestamp(currentBlock.MEDIAN_TIME || '')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Inséré le</span>
                          <span className="text-white">{formatTimestamp(currentBlock.INSERTED_TIMESTAMP || '')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 p-4 rounded-lg mb-8">
                  <pre className="text-white overflow-auto max-h-96 font-mono text-sm">
                    {toJSON(currentBlock)}
                  </pre>
                </div>
              )}

              {/* Transactions in the block */}
              {transactionsForBlock.length > 0 && (
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-semibold text-white">Transactions</h4>
                    <div className="flex gap-2">
                      <button 
                        onClick={toggleTxListViewMode}
                        className="text-bitcoin-orange hover:underline flex items-center"
                      >
                        {txListViewMode === 'overview' ? 'Show Raw' : 'Show Overview'}
                        {txListViewMode === 'overview' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg overflow-hidden">
                    {txListViewMode === 'overview' ? (
                      <table className="min-w-full divide-y divide-gray-800">
                        <thead className="bg-white/5">
                          <tr>
                            <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">TX ID</th>
                            <th scope="col" className="py-3.5 px-4 text-right text-sm font-semibold text-gray-300">Valeur</th>
                            <th scope="col" className="py-3.5 px-4 text-right text-sm font-semibold text-gray-300">Frais</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactionsForBlock.map((tx: Transaction, idx: number) => (
                            <tr 
                              key={tx.TX_ID} 
                              className={`border-t border-gray-800 hover:bg-white/10 ${selectedTransactionForTxList === tx.TX_ID ? 'bg-white/10' : ''}`}
                            >
                              <td className="whitespace-nowrap py-4 px-4 font-medium">
                                <span 
                                  className="text-bitcoin-orange hover:underline cursor-pointer font-mono text-sm"
                                  onClick={() => viewTransactionDetails(tx.TX_ID)}
                                >
                                  {idx === 0 ? 'Récompense des blocs' : tx.TX_ID.substring(0, 10) + '...'}
                                </span>
                              </td>
                              <td className="whitespace-nowrap py-4 px-4 text-right text-white">
                                {formatBtcValue(tx.OUTPUT_VALUE)}
                              </td>
                              <td className="whitespace-nowrap py-4 px-4 text-right text-white">
                                {tx.IS_COINBASE ? '0 BTC' : formatBtcValue(tx.FEE)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <pre className="text-white overflow-auto max-h-96 font-mono text-sm p-4">
                        {toJSON(transactionsForBlock)}
                      </pre>
                    )}
                  </div>
                </div>
              )}
              
              {/* Selected transaction details within block view */}
              {showTransactionDetails && currentTransaction && selectedTransactionForTxList && (
                <div className="mt-8">
                  <div className="border-t border-gray-700 pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xl font-semibold text-white">Transaction Details</h4>
                      <button
                        onClick={() => setShowTransactionDetails(false)}
                        className="text-gray-400 hover:text-white"
                      >
                        Close
                      </button>
                    </div>
                    
                    {/* Render transaction details */}
                    {renderTransactionDetails()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transaction Details (when searched directly) */}
          {currentTransaction && !currentBlock && (
            <div className="p-6">
              {renderTransactionDetails()}
            </div>
          )}

          {/* Address Details */}
          {currentAddress && (
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 flex items-center justify-center mr-4">
                    <Bitcoin size={28} color="#000" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{currentAddress.ADDRESS.substring(0, 12)}...</h3>
                    {currentAddress.PROJECT_NAME && (
                      <p className="text-gray-400">Entity: {currentAddress.PROJECT_NAME}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-lg p-6 mb-8">
                <h4 className="text-lg font-semibold mb-4 text-white">Summary</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Address</span>
                    <span className="text-white break-all font-mono text-sm">{currentAddress.ADDRESS}</span>
                  </div>
                  {currentAddress.PROJECT_NAME && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Entity</span>
                      <span className="text-white">{currentAddress.PROJECT_NAME}</span>
                    </div>
                  )}
                  {currentAddress.ADDRESS_GROUP !== null && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Address Group</span>
                      <span className="text-white">{currentAddress.ADDRESS_GROUP}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Transactions for Address */}
              {transactionsForAddress.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-semibold text-white">Transactions ({transactionsForAddress.length})</h4>
                    <button
                      onClick={() => downloadJSON(transactionsForAddress, `txs-address-${currentAddress.ADDRESS}.json`)}
                      className="text-bitcoin-orange hover:underline flex items-center"
                      title="Download as JSON"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                  <div className="bg-white/5 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-800">
                      <thead className="bg-white/5">
                        <tr>
                          <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">ID</th>
                          <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Time</th>
                          <th scope="col" className="py-3.5 px-4 text-right text-sm font-semibold text-gray-300">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactionsForAddress.map((tx: Transaction) => (
                          <tr key={tx.TX_ID} className="border-t border-gray-800 hover:bg-white/10">
                            <td className="whitespace-nowrap py-4 px-4 font-medium">
                              <span 
                                className="text-bitcoin-orange hover:underline cursor-pointer font-mono text-sm"
                                onClick={() => viewTransactionDetails(tx.TX_ID)}
                              >
                                {tx.TX_ID.substring(0, 10)}...
                              </span>
                            </td>
                            <td className="whitespace-nowrap py-4 px-4 text-white">
                              {formatTimestamp(tx.BLOCK_TIMESTAMP)}
                            </td>
                            <td className="whitespace-nowrap py-4 px-4 text-right text-white">
                              {formatBtcValue(tx.OUTPUT_VALUE)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Latest Blocks (shown when no specific item is selected) */}
          {!currentBlock && !currentTransaction && !currentAddress && (
            <div className="px-6 py-4">
              <div className="bg-white/5 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-800">
                  <thead className="bg-white/5">
                    <tr>
                      <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Numéro</th>
                      <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Hashage</th>
                      <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Mineur</th>
                      <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Minés</th>
                      <th scope="col" className="py-3.5 px-4 text-right text-sm font-semibold text-gray-300">Nombre de Tx</th>
                      <th scope="col" className="py-3.5 px-4 text-right text-sm font-semibold text-gray-300">Nonce</th>
                      <th scope="col" className="py-3.5 px-4 text-right text-sm font-semibold text-gray-300">Taille</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestBlocks.map((block: Block) => (
                      <tr key={block.BLOCK_NUMBER} className="border-t border-gray-800 hover:bg-white/10">
                        <td className="whitespace-nowrap py-4 px-4 font-medium">
                          <span 
                            className="text-bitcoin-orange hover:underline cursor-pointer"
                            onClick={() => {
                              setSearchQuery(block.BLOCK_NUMBER.toString());
                              setSearchType('block');
                              handleSearchWithParams(block.BLOCK_NUMBER.toString(), 'block');
                            }}
                          >
                            {block.BLOCK_NUMBER}
                          </span>
                        </td>
                        <td className="py-4 px-4 max-w-xs overflow-hidden">
                          <span className="text-white font-mono text-sm">
                            {block.BLOCK_HASH.substring(0, 8)}...
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-4 px-4 text-white">
                          Unknown
                        </td>
                        <td className="whitespace-nowrap py-4 px-4 text-white">
                          {formatElapsedTime(block.BLOCK_TIMESTAMP)}
                        </td>
                        <td className="whitespace-nowrap py-4 px-4 text-right text-white">
                          {block.TX_COUNT}
                        </td>
                        <td className="whitespace-nowrap py-4 px-4 text-right text-white">
                          {block.NONCE || 'N/A'}
                        </td>
                        <td className="whitespace-nowrap py-4 px-4 text-right text-white">
                          {block.SIZE.toLocaleString()} bytes
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// Add a helper function to format elapsed time like "19m 5s" or "1h 7m 50s"
const formatElapsedTime = (timestamp: string) => {
  if (!timestamp) return 'N/A';
  
  const blockTime = new Date(timestamp).getTime();
  const now = new Date().getTime();
  const diffMs = now - blockTime;
  
  // Convert to minutes and seconds
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  
  if (diffHrs > 0) {
    const mins = diffMins % 60;
    const secs = Math.floor((diffMs % 60000) / 1000);
    return `${diffHrs}h ${mins}m ${secs}s`;
  } else {
    const secs = Math.floor((diffMs % 60000) / 1000);
    return `${diffMins}m ${secs}s`;
  }
}; 