import { Request, Response } from 'express';
import { ScannerService } from '../services/ScannerService';
import { BlockchainService } from '../services/BlockchainService';
import Transaction from '../models/Transaction';
import logger from '../utils/logger';

export class ApiController {
  private scannerService: ScannerService;
  private blockchainService: BlockchainService;

  constructor(scannerService: ScannerService) {
    this.scannerService = scannerService;
    this.blockchainService = new BlockchainService();
  }

  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.scannerService.getStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stats'
      });
    }
  }

  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const userAddress = req.query.user as string;
      const dexName = req.query.dex as string;
      const processed = req.query.processed as string;
      
      const skip = (page - 1) * limit;
      
      const filter: any = {};
      if (userAddress) filter.from = { $regex: new RegExp(`^${userAddress}$`, 'i') };
      if (dexName) filter.dexName = dexName;
      if (processed !== undefined) filter.processed = processed === 'true';

      const [transactions, total] = await Promise.all([
        Transaction.find(filter)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Transaction.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error getting transactions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get transactions'
      });
    }
  }

  async getUserCashback(req: Request, res: Response): Promise<void> {
    try {
      const userAddress = req.params.address?.toLowerCase();
      
      if (!userAddress) {
        res.status(400).json({
          success: false,
          error: 'User address is required'
        });
        return;
      }

      const [transactions, stats] = await Promise.all([
        Transaction.find({ from: userAddress })
          .sort({ timestamp: -1 })
          .lean(),
        Transaction.aggregate([
          { $match: { from: userAddress, processed: true } },
          {
            $group: {
              _id: null,
              totalCashback: { $sum: { $toDouble: '$cashbackAmount' } },
              totalTransactions: { $sum: 1 },
              avgCashbackRate: { $avg: '$cashbackRate' }
            }
          }
        ])
      ]);

      const pending = await Transaction.aggregate([
        { $match: { from: userAddress, processed: false, cashbackAmount: { $gt: '0' } } },
        {
          $group: {
            _id: null,
            pendingCashback: { $sum: { $toDouble: '$cashbackAmount' } },
            pendingTransactions: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          userAddress,
          transactions,
          totalStats: stats[0] || {
            totalCashback: 0,
            totalTransactions: 0,
            avgCashbackRate: 0
          },
          pendingStats: pending[0] || {
            pendingCashback: 0,
            pendingTransactions: 0
          }
        }
      });
    } catch (error) {
      logger.error('Error getting user cashback:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user cashback'
      });
    }
  }

  async getDexStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await Transaction.aggregate([
        {
          $group: {
            _id: '$dexName',
            totalTransactions: { $sum: 1 },
            totalVolume: { $sum: { $toDouble: '$value' } },
            totalCashback: { $sum: { $toDouble: '$cashbackAmount' } },
            avgCashbackRate: { $avg: '$cashbackRate' },
            processedTransactions: {
              $sum: { $cond: ['$processed', 1, 0] }
            }
          }
        },
        {
          $project: {
            dexName: '$_id',
            totalTransactions: 1,
            totalVolume: { $divide: ['$totalVolume', 1000000000000000000] },
            totalCashback: 1,
            avgCashbackRate: 1,
            processedTransactions: 1,
            processingRate: {
              $divide: ['$processedTransactions', '$totalTransactions']
            }
          }
        },
        { $sort: { totalTransactions: -1 } }
      ]);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting DEX stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get DEX stats'
      });
    }
  }

  async health(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.scannerService.getStats();
      const lastScanTime = stats.scannerState?.lastScanTime;
      const timeSinceLastScan = lastScanTime ? Date.now() - new Date(lastScanTime).getTime() : null;
      
      const isHealthy = timeSinceLastScan ? timeSinceLastScan < 120000 : false;

      res.json({
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'unhealthy',
          lastScanTime,
          timeSinceLastScan,
          treasuryBalance: stats.treasuryBalance,
          totalTransactions: stats.totalTransactions,
          processedTransactions: stats.processedTransactions
        }
      });
    } catch (error) {
      logger.error('Error checking health:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check health'
      });
    }
  }

  async getWalletBalance(req: Request, res: Response): Promise<void> {
    try {
      const userAddress = req.params.address?.toLowerCase();
      
      if (!userAddress) {
        res.status(400).json({
          success: false,
          error: 'User address is required'
        });
        return;
      }

      const cashbackBalance = await this.blockchainService.getCashbackBalance(userAddress);
      
      const transactions = await Transaction.find({ 
        from: userAddress,
        processed: true 
      }).sort({ timestamp: -1 }).limit(10).lean();

      res.json({
        success: true,
        data: {
          userAddress,
          cashbackBalance,
          recentTransactions: transactions
        }
      });
    } catch (error) {
      logger.error('Error getting wallet balance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get wallet balance'
      });
    }
  }

  async calculateClaimFee(req: Request, res: Response): Promise<void> {
    try {
      const { amount } = req.body;
      
      if (!amount || parseFloat(amount) <= 0) {
        res.status(400).json({
          success: false,
          error: 'Valid amount is required'
        });
        return;
      }

      const fee = await this.blockchainService.calculateClaimFee(amount);
      const netAmount = parseFloat(amount) - parseFloat(fee);

      res.json({
        success: true,
        data: {
          requestedAmount: amount,
          claimFee: fee,
          netAmount: netAmount.toString(),
          treasuryShare: (parseFloat(fee) * 0.9).toString(),
          sonicShare: (parseFloat(fee) * 0.1).toString()
        }
      });
    } catch (error) {
      logger.error('Error calculating claim fee:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate claim fee'
      });
    }
  }

  async processClaim(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress, amount } = req.body;
      
      if (!userAddress || !amount || parseFloat(amount) <= 0) {
        res.status(400).json({
          success: false,
          error: 'Valid user address and amount are required'
        });
        return;
      }

      const currentBalance = await this.blockchainService.getCashbackBalance(userAddress);
      
      if (parseFloat(currentBalance) < parseFloat(amount)) {
        res.status(400).json({
          success: false,
          error: 'Insufficient cashback balance'
        });
        return;
      }

      const result = await this.blockchainService.processClaim(userAddress, amount);

      res.json({
        success: true,
        data: {
          userAddress,
          claimedAmount: amount,
          feeAmount: result.feeAmount,
          netAmount: (parseFloat(amount) - parseFloat(result.feeAmount)).toString(),
          transactionHash: result.txHash
        }
      });
    } catch (error) {
      logger.error('Error processing claim:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process claim'
      });
    }
  }

  async getTotalCashbackHeld(req: Request, res: Response): Promise<void> {
    try {
      const totalHeld = await this.blockchainService.getTotalCashbackHeld();
      
      const topHolders = await Transaction.aggregate([
        { $match: { processed: true } },
        {
          $group: {
            _id: '$from',
            totalCashback: { $sum: { $toDouble: '$cashbackAmount' } },
            transactionCount: { $sum: 1 }
          }
        },
        { $sort: { totalCashback: -1 } },
        { $limit: 10 }
      ]);

      res.json({
        success: true,
        data: {
          totalCashbackHeld: totalHeld,
          topHolders
        }
      });
    } catch (error) {
      logger.error('Error getting total cashback held:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get total cashback held'
      });
    }
  }
}