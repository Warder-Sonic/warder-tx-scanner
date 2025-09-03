import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { ScannerService } from './services/ScannerService';
import { ApiController } from './controllers/ApiController';
import { CONFIG } from './config';
import logger from './utils/logger';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

let scannerService: ScannerService;
let apiController: ApiController;

async function connectDatabase() {
  try {
    await mongoose.connect(CONFIG.MONGODB_URI);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

async function initializeServices() {
  scannerService = new ScannerService();
  apiController = new ApiController(scannerService);
  
  await scannerService.start();
  logger.info('Scanner service started');
}

function setupRoutes() {
  app.get('/health', (req, res) => apiController.health(req, res));
  app.get('/api/stats', (req, res) => apiController.getStats(req, res));
  app.get('/api/transactions', (req, res) => apiController.getTransactions(req, res));
  app.get('/api/users/:address/cashback', (req, res) => apiController.getUserCashback(req, res));
  app.get('/api/users/:address/balance', (req, res) => apiController.getWalletBalance(req, res));
  app.get('/api/wallet/:address/balance', (req, res) => apiController.getWalletBalance(req, res));
  app.get('/api/dex/stats', (req, res) => apiController.getDexStats(req, res));
  app.get('/api/cashback/total', (req, res) => apiController.getTotalCashbackHeld(req, res));
  app.post('/api/claim/calculate-fee', (req, res) => apiController.calculateClaimFee(req, res));
  app.post('/api/claim/process', (req, res) => apiController.processClaim(req, res));
  
  app.get('/', (req, res) => {
    res.json({
      name: 'Warder Transaction Scanner',
      version: '1.0.0',
      description: 'Scans Sonic blockchain for DEX transactions and distributes $S cashback',
      endpoints: [
        'GET /health - Health check',
        'GET /api/stats - Scanner statistics',
        'GET /api/transactions - Get transactions with pagination',
        'GET /api/users/:address/cashback - Get user cashback data',
        'GET /api/users/:address/balance - Get user wallet balance',
        'GET /api/wallet/:address/balance - Get user wallet balance (alias)',
        'GET /api/dex/stats - DEX statistics',
        'GET /api/cashback/total - Get total cashback held',
        'POST /api/claim/calculate-fee - Calculate claim fee',
        'POST /api/claim/process - Process cashback claim'
      ]
    });
  });
}

async function start() {
  try {
    logger.info('Starting Warder Transaction Scanner...');
    
    await connectDatabase();
    setupRoutes();
    await initializeServices();
    
    app.listen(CONFIG.PORT, () => {
      logger.info(`Server running on port ${CONFIG.PORT}`);
      logger.info(`Network: ${CONFIG.NETWORK}`);
      logger.info(`RPC: ${CONFIG.NETWORK === 'mainnet' ? CONFIG.SONIC_MAINNET_RPC_URL : CONFIG.SONIC_RPC_URL}`);
      logger.info(`Treasury: ${CONFIG.TREASURY_CONTRACT}`);
      logger.info('Scanner is now monitoring Sonic blockchain for DEX transactions');
    });

  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  
  if (scannerService) {
    await scannerService.stop();
  }
  
  await mongoose.connection.close();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

start();