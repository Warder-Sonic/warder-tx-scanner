export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: number;
  timestamp: number;
  gasUsed?: string;
  gasPrice?: string;
  contractAddress?: string;
  tokenSymbol?: string;
  tokenAmount?: string;
  dexName?: string;
  swapType?: 'buy' | 'sell' | 'transfer';
}

export interface CashbackRule {
  contractAddress: string;
  dexName: string;
  baseRate: number;
  maxCashback?: number;
  minTransaction?: number;
  isActive: boolean;
  boostMultiplier?: number;
  description?: string;
}

export interface ProcessedTransaction {
  txHash: string;
  userAddress: string;
  originalAmount: string;
  cashbackRate: number;
  cashbackAmount: string;
  dexName: string;
  processed: boolean;
  processedAt?: Date;
  blockNumber: number;
  timestamp: Date;
  treasuryTxHash?: string;
}

export interface ScannerStats {
  lastScannedBlock: number;
  totalTransactionsProcessed: number;
  totalCashbackPaid: string;
  lastScanTime: Date;
  activeRules: number;
}