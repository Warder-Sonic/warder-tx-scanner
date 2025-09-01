import { ethers } from 'ethers';
import { CASHBACK_RULES } from '../config';
import { Transaction, CashbackRule } from '../types';
import logger from '../utils/logger';

export class CashbackService {
  
  calculateCashback(transaction: Transaction): { amount: string; rate: number } | null {
    const rule = this.getCashbackRule(transaction.contractAddress || transaction.to);
    
    if (!rule || !rule.isActive) {
      return null;
    }

    const transactionValueEth = parseFloat(ethers.formatEther(transaction.value));
    
    if (transactionValueEth < rule.minTransaction) {
      logger.debug(`Transaction ${transaction.hash} below minimum: ${transactionValueEth} < ${rule.minTransaction}`);
      return null;
    }

    let cashbackAmount = transactionValueEth * rule.baseRate;
    
    if (rule.boostMultiplier && this.shouldApplyBoost(transaction)) {
      cashbackAmount *= rule.boostMultiplier;
      logger.info(`Boost applied to ${transaction.hash}: ${rule.boostMultiplier}x`);
    }

    if (rule.maxCashback && cashbackAmount > rule.maxCashback) {
      cashbackAmount = rule.maxCashback;
    }

    logger.info(`Cashback calculated for ${transaction.hash}: ${cashbackAmount} S (${rule.baseRate * 100}% rate)`);
    
    return {
      amount: cashbackAmount.toFixed(6),
      rate: rule.baseRate
    };
  }

  private getCashbackRule(contractAddress: string): CashbackRule | null {
    return CASHBACK_RULES.find(rule => 
      rule.contractAddress.toLowerCase() === contractAddress.toLowerCase()
    ) || null;
  }

  private shouldApplyBoost(transaction: Transaction): boolean {
    const transactionValueEth = parseFloat(ethers.formatEther(transaction.value));
    
    if (transactionValueEth >= 100) {
      return true;
    }
    
    if (this.isHighVolumeUser(transaction.from)) {
      return true;
    }
    
    if (this.isWeekendBoost()) {
      return true;
    }

    return false;
  }

  private isHighVolumeUser(userAddress: string): boolean {
    return false;
  }

  private isWeekendBoost(): boolean {
    const now = new Date();
    const day = now.getDay();
    return day === 0 || day === 6;
  }

  getActiveCashbackRules(): CashbackRule[] {
    return CASHBACK_RULES.filter(rule => rule.isActive);
  }

  getDexStats(): { [key: string]: CashbackRule } {
    const stats: { [key: string]: CashbackRule } = {};
    
    for (const rule of CASHBACK_RULES) {
      if (rule.isActive) {
        stats[rule.dexName] = rule;
      }
    }
    
    return stats;
  }
}