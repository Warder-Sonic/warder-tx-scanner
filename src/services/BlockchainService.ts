import { ethers } from 'ethers';
import { CONFIG, SONIC_CONTRACTS, TREASURY_ABI } from '../config';
import { Transaction } from '../types';
import logger from '../utils/logger';

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;
  private treasuryContract?: ethers.Contract;

  constructor() {
    const rpcUrl = CONFIG.NETWORK === 'mainnet' ? CONFIG.SONIC_MAINNET_RPC_URL : CONFIG.SONIC_RPC_URL;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    if (CONFIG.PRIVATE_KEY) {
      this.wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, this.provider);
      this.treasuryContract = new ethers.Contract(CONFIG.TREASURY_CONTRACT, TREASURY_ABI, this.wallet);
    }
  }

  async getLatestBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      logger.error('Error getting latest block number:', error);
      throw error;
    }
  }

  async getBlockTransactions(blockNumber: number): Promise<Transaction[]> {
    try {
      const block = await this.provider.getBlock(blockNumber, true);
      if (!block) {
        logger.warn(`Block ${blockNumber} not found`);
        return [];
      }

      const transactions: Transaction[] = [];
      
      for (const tx of block.transactions) {
        if (typeof tx === 'string') continue;
        
        const receipt = await this.provider.getTransactionReceipt(tx.hash);
        if (!receipt) continue;

        const transaction: Transaction = {
          hash: tx.hash,
          from: tx.from,
          to: tx.to || '',
          value: tx.value.toString(),
          blockNumber: tx.blockNumber || blockNumber,
          timestamp: block.timestamp,
          gasUsed: receipt.gasUsed.toString(),
          gasPrice: tx.gasPrice?.toString(),
          contractAddress: receipt.to || ''
        };

        if (this.isDexTransaction(transaction.to)) {
          transaction.dexName = this.getDexName(transaction.to);
          transaction.swapType = this.getSwapType(transaction);
          transactions.push(transaction);
        }
      }

      logger.info(`Found ${transactions.length} DEX transactions in block ${blockNumber}`);
      return transactions;
    } catch (error) {
      logger.error(`Error scanning block ${blockNumber}:`, error);
      return [];
    }
  }

  async sendCashback(userAddress: string, amount: string): Promise<string> {
    if (!this.treasuryContract || !this.wallet) {
      throw new Error('Treasury contract or wallet not initialized');
    }

    try {
      logger.info(`Sending cashback: ${amount} S to ${userAddress}`);
      
      const amountWei = ethers.parseEther(amount);
      const tx = await this.treasuryContract.transferToWallet(userAddress, amountWei);
      
      logger.info(`Cashback transaction sent: ${tx.hash}`);
      await tx.wait();
      
      logger.info(`Cashback confirmed: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      logger.error('Error sending cashback:', error);
      throw error;
    }
  }

  async getTreasuryBalance(): Promise<string> {
    if (!this.treasuryContract) {
      throw new Error('Treasury contract not initialized');
    }

    try {
      const balance = await this.treasuryContract.getBalance();
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Error getting treasury balance:', error);
      throw error;
    }
  }

  private isDexTransaction(toAddress: string): boolean {
    const dexAddresses = [
      SONIC_CONTRACTS.SHADOW_ROUTER,
      SONIC_CONTRACTS.SHADOW_UNIVERSAL_ROUTER,
      SONIC_CONTRACTS.SONICSWAP_ROUTER,
      SONIC_CONTRACTS.WAGMI_CONTRACT
    ];
    
    return dexAddresses.some(addr => addr.toLowerCase() === toAddress.toLowerCase());
  }

  private getDexName(contractAddress: string): string {
    const dexMap: { [key: string]: string } = {
      [SONIC_CONTRACTS.SHADOW_ROUTER.toLowerCase()]: 'Shadow Exchange',
      [SONIC_CONTRACTS.SHADOW_UNIVERSAL_ROUTER.toLowerCase()]: 'Shadow Exchange Universal',
      [SONIC_CONTRACTS.SONICSWAP_ROUTER.toLowerCase()]: 'SonicSwap',
      [SONIC_CONTRACTS.WAGMI_CONTRACT.toLowerCase()]: 'WAGMI'
    };
    
    return dexMap[contractAddress.toLowerCase()] || 'Unknown DEX';
  }

  private getSwapType(transaction: Transaction): 'buy' | 'sell' | 'transfer' {
    if (parseFloat(ethers.formatEther(transaction.value)) > 0) {
      return 'buy';
    }
    return 'transfer';
  }
}