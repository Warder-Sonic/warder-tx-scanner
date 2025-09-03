import { ethers } from 'ethers';
import { CONFIG, SONIC_CONTRACTS, TREASURY_ABI, WALLET_ABI } from '../config';
import { Transaction } from '../types';
import logger from '../utils/logger';

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;
  private treasuryContract?: ethers.Contract;
  private walletContract?: ethers.Contract;
  private feeManagerContract?: ethers.Contract;

  constructor() {
    const rpcUrl = CONFIG.NETWORK === 'mainnet' ? CONFIG.SONIC_MAINNET_RPC_URL : CONFIG.SONIC_RPC_URL;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    if (CONFIG.PRIVATE_KEY) {
      this.wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, this.provider);
      this.treasuryContract = new ethers.Contract(CONFIG.TREASURY_CONTRACT, TREASURY_ABI, this.wallet);
      this.walletContract = new ethers.Contract(CONFIG.WALLET_CONTRACT, WALLET_ABI, this.wallet);
      
      const FEE_MANAGER_ABI = [
        "function processClaim(address _user, uint256 _amount) external payable",
        "function calculateFee(uint256 _amount) external view returns (uint256)",
        "function treasuryShare() external view returns (uint256)",
        "function sonicShare() external view returns (uint256)"
      ];
      this.feeManagerContract = new ethers.Contract(CONFIG.FEE_MANAGER_CONTRACT, FEE_MANAGER_ABI, this.wallet);
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
      if (blockNumber === 582887) {
        logger.info(`Block 582887 has ${block?.transactions?.length || 0} transactions`);
        if (block?.transactions) {
          for (let i = 0; i < Math.min(3, block.transactions.length); i++) {
            const tx = block.transactions[i];
            logger.info(`TX ${i}: ${typeof tx === 'string' ? tx : (tx as any).hash}`);
          }
        }
      }
      if (!block) {
        logger.warn(`Block ${blockNumber} not found`);
        return [];
      }

      const transactions: Transaction[] = [];
      
      for (const txData of block.transactions) {
        let tx;
        if (typeof txData === 'string') {
          tx = await this.provider.getTransaction(txData);
          if (!tx) continue;
        } else {
          tx = txData;
        }
        
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

        const targetAddress = tx.to || receipt.to || '';
        
        if (tx.hash === '0x8fed66e80741290eb3f14c54bbd1ed5a255ac3913326ec2fa3449c8ffd655a65') {
          logger.info(`FOUND YOUR TX: tx.to=${tx.to}, receipt.to=${receipt.to}, targetAddress=${targetAddress}`);
          logger.info(`isDexTransaction(${targetAddress}) = ${this.isDexTransaction(targetAddress)}`);
        }
        
        if (this.isDexTransaction(targetAddress)) {
          transaction.dexName = this.getDexName(targetAddress);
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

  async getCashbackBalance(userAddress: string): Promise<string> {
    if (!this.walletContract) {
      throw new Error('Wallet contract not initialized');
    }

    try {
      const balance = await this.walletContract.cashbackBalances(userAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Error getting cashback balance:', error);
      throw error;
    }
  }

  async getTotalCashbackHeld(): Promise<string> {
    if (!this.walletContract) {
      throw new Error('Wallet contract not initialized');
    }

    try {
      const total = await this.walletContract.totalCashbackHeld();
      return ethers.formatEther(total);
    } catch (error) {
      logger.error('Error getting total cashback held:', error);
      throw error;
    }
  }

  async creditCashback(userAddress: string, amount: string): Promise<string> {
    if (!this.walletContract || !this.wallet) {
      throw new Error('Wallet contract or wallet not initialized');
    }

    try {
      logger.info(`Crediting cashback: ${amount} S to ${userAddress}`);
      
      const amountWei = ethers.parseEther(amount);
      const tx = await this.walletContract.creditCashback(userAddress, amountWei);
      
      logger.info(`Credit cashback transaction sent: ${tx.hash}`);
      await tx.wait();
      
      logger.info(`Credit cashback confirmed: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      logger.error('Error crediting cashback:', error);
      throw error;
    }
  }

  async processClaim(userAddress: string, amount: string): Promise<{ txHash: string; feeAmount: string }> {
    if (!this.feeManagerContract || !this.wallet) {
      throw new Error('Fee Manager contract or wallet not initialized');
    }

    try {
      const amountWei = ethers.parseEther(amount);
      
      const feeAmount = await this.feeManagerContract.calculateFee(amountWei);
      logger.info(`Calculated claim fee: ${ethers.formatEther(feeAmount)} S for amount ${amount} S`);
      
      const tx = await this.feeManagerContract.processClaim(userAddress, amountWei, {
        value: feeAmount
      });
      
      logger.info(`Claim transaction sent: ${tx.hash}`);
      await tx.wait();
      
      logger.info(`Claim confirmed: ${tx.hash}`);
      return {
        txHash: tx.hash,
        feeAmount: ethers.formatEther(feeAmount)
      };
    } catch (error) {
      logger.error('Error processing claim:', error);
      throw error;
    }
  }

  async calculateClaimFee(amount: string): Promise<string> {
    if (!this.feeManagerContract) {
      throw new Error('Fee Manager contract not initialized');
    }

    try {
      const amountWei = ethers.parseEther(amount);
      const fee = await this.feeManagerContract.calculateFee(amountWei);
      return ethers.formatEther(fee);
    } catch (error) {
      logger.error('Error calculating claim fee:', error);
      throw error;
    }
  }

  private isDexTransaction(toAddress: string): boolean {
    const dexAddresses = [
      SONIC_CONTRACTS.SHADOW_ROUTER,
      SONIC_CONTRACTS.SHADOW_UNIVERSAL_ROUTER,
      SONIC_CONTRACTS.SONICSWAP_ROUTER,
      SONIC_CONTRACTS.WAGMI_CONTRACT,
      SONIC_CONTRACTS.TEST_DEX_ROUTER
    ];
    
    return dexAddresses.some(addr => addr.toLowerCase() === toAddress.toLowerCase());
  }

  private getDexName(contractAddress: string): string {
    const dexMap: { [key: string]: string } = {
      [SONIC_CONTRACTS.SHADOW_ROUTER.toLowerCase()]: 'Shadow Exchange',
      [SONIC_CONTRACTS.SHADOW_UNIVERSAL_ROUTER.toLowerCase()]: 'Shadow Exchange Universal',
      [SONIC_CONTRACTS.SONICSWAP_ROUTER.toLowerCase()]: 'SonicSwap',
      [SONIC_CONTRACTS.WAGMI_CONTRACT.toLowerCase()]: 'WAGMI',
      [SONIC_CONTRACTS.TEST_DEX_ROUTER.toLowerCase()]: 'Test DEX'
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