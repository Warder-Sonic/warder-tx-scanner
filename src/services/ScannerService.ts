import cron from 'node-cron';
import { BlockchainService } from './BlockchainService';
import { CashbackService } from './CashbackService';
import Transaction from '../models/Transaction';
import ScannerState from '../models/ScannerState';
import { CONFIG } from '../config';
import logger from '../utils/logger';
import { ethers } from 'ethers';

export class ScannerService {
  private blockchainService: BlockchainService;
  private cashbackService: CashbackService;
  private isScanning = false;
  private scannerName = 'main-scanner';

  constructor() {
    this.blockchainService = new BlockchainService();
    this.cashbackService = new CashbackService();
  }

  async start(): Promise<void> {
    logger.info('Starting Warder Transaction Scanner...');
    
    await this.initializeScannerState();
    
    const cronPattern = `*/${CONFIG.SCAN_INTERVAL_SECONDS} * * * * *`;
    logger.info(`Setting up scanner with interval: ${CONFIG.SCAN_INTERVAL_SECONDS} seconds`);
    
    cron.schedule(cronPattern, async () => {
      if (!this.isScanning) {
        await this.scanAndProcess();
      }
    });

    await this.scanAndProcess();
    
    logger.info('Scanner started successfully');
  }

  private async scanAndProcess(): Promise<void> {
    if (this.isScanning) {
      logger.warn('Scanner already running, skipping this cycle');
      return;
    }

    this.isScanning = true;
    
    try {
      const scannerState = await ScannerState.findOne({ name: this.scannerName });
      if (!scannerState) {
        logger.error('Scanner state not found');
        return;
      }

      const latestBlock = await this.blockchainService.getLatestBlockNumber();
      const startBlock = scannerState.lastScannedBlock + 1;
      
      logger.info(`Scanning blocks ${startBlock} to ${latestBlock}`);
      
      if (startBlock > latestBlock) {
        logger.debug('No new blocks to scan');
        return;
      }

      let processedTransactions = 0;
      let totalCashbackPaid = ethers.parseEther(scannerState.totalCashbackPaid);

      for (let blockNumber = startBlock; blockNumber <= latestBlock; blockNumber++) {
        const transactions = await this.blockchainService.getBlockTransactions(blockNumber);
        
        for (const tx of transactions) {
          const existingTx = await Transaction.findOne({ hash: tx.hash });
          if (existingTx) {
            continue;
          }

          const cashbackResult = this.cashbackService.calculateCashback(tx);
          
          const newTx = new Transaction({
            ...tx,
            timestamp: new Date(tx.timestamp * 1000),
            processed: false,
            cashbackAmount: cashbackResult?.amount || '0',
            cashbackRate: cashbackResult?.rate || 0
          });

          await newTx.save();

          if (cashbackResult && parseFloat(cashbackResult.amount) > 0) {
            try {
              const treasuryTxHash = await this.blockchainService.sendCashback(
                tx.from,
                cashbackResult.amount
              );

              newTx.processed = true;
              newTx.treasuryTxHash = treasuryTxHash;
              newTx.processedAt = new Date();
              await newTx.save();

              totalCashbackPaid += ethers.parseEther(cashbackResult.amount);
              processedTransactions++;

              logger.info(`Cashback sent: ${cashbackResult.amount} S to ${tx.from} (${tx.dexName})`);
              
            } catch (error) {
              logger.error(`Failed to send cashback for tx ${tx.hash}:`, error);
            }
          }
        }
      }

      scannerState.lastScannedBlock = latestBlock;
      scannerState.totalTransactionsProcessed += processedTransactions;
      scannerState.totalCashbackPaid = ethers.formatEther(totalCashbackPaid);
      scannerState.lastScanTime = new Date();
      await scannerState.save();

      logger.info(`Scan complete. Processed ${processedTransactions} transactions, paid ${ethers.formatEther(totalCashbackPaid)} S total`);
      
    } catch (error) {
      logger.error('Error during scan and process:', error);
    } finally {
      this.isScanning = false;
    }
  }

  private async initializeScannerState(): Promise<void> {
    let scannerState = await ScannerState.findOne({ name: this.scannerName });
    
    if (!scannerState) {
      const latestBlock = await this.blockchainService.getLatestBlockNumber();
      
      scannerState = new ScannerState({
        name: this.scannerName,
        lastScannedBlock: latestBlock - 10,
        totalTransactionsProcessed: 0,
        totalCashbackPaid: '0',
        lastScanTime: new Date(),
        isActive: true
      });
      
      await scannerState.save();
      logger.info(`Initialized scanner state starting from block ${latestBlock - 10}`);
    } else {
      logger.info(`Scanner state loaded: last scanned block ${scannerState.lastScannedBlock}`);
    }
  }

  async getStats(): Promise<any> {
    const scannerState = await ScannerState.findOne({ name: this.scannerName });
    const totalTransactions = await Transaction.countDocuments();
    const processedTransactions = await Transaction.countDocuments({ processed: true });
    const treasuryBalance = await this.blockchainService.getTreasuryBalance();
    
    return {
      scannerState: scannerState || null,
      totalTransactions,
      processedTransactions,
      pendingTransactions: totalTransactions - processedTransactions,
      treasuryBalance,
      cashbackRules: this.cashbackService.getActiveCashbackRules(),
      dexStats: this.cashbackService.getDexStats()
    };
  }

  async stop(): Promise<void> {
    logger.info('Stopping scanner...');
    this.isScanning = false;
  }
}