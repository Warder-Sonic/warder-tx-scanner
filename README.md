# Warder Transaction Scanner

Transaction scanner for Sonic blockchain that monitors DEX swaps and automatically distributes $S cashback rewards to users.

## Live DEX Integration

### Supported DEXs on Sonic Mainnet:
- **Shadow Exchange**: 6.5% base rate (Router: `0x1D368773735ee1E678950B7A97bcA2CafB330CDc`)
- **Shadow Exchange Universal**: 5.8% base rate (Router: `0x92643Dc4F75C374b689774160CDea09A0704a9c2`)
- **SonicSwap**: 4.8% base rate (Router: `0x8885b3cfF909e129d9F8f75b196503F4F8B1A351`)
- **WAGMI**: 4.2% base rate (Contract: `0x92cc36d66e9d739d50673d1f27929a371fb83a67`)

## Setup

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Configure your .env file with:
SONIC_RPC_URL=https://rpc.testnet.soniclabs.com/
SONIC_MAINNET_RPC_URL=https://rpc.soniclabs.com/
TREASURY_CONTRACT=0x1DC6CEE4D32Cc8B06fC4Cea268ccd774451E08b4
WALLET_CONTRACT=0xa83F9277F984DF0056E7E690016c1eb4FC5757ca
STOKEN_CONTRACT=0x2789213A4725FFF214DF9cA5B2fFe3b446f6A9e5
PRIVATE_KEY=your_private_key_here
MONGODB_URI=mongodb://localhost:27017/warder-scanner
NETWORK=mainnet

# Start MongoDB
mongod

# Run the scanner
npm run dev
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/stats` - Scanner statistics and treasury balance
- `GET /api/transactions` - Get transactions with pagination/filters
- `GET /api/users/:address/cashback` - Get user-specific cashback data
- `GET /api/dex/stats` - DEX volume and cashback statistics

## How It Works

1. **Blockchain Monitoring**: Continuously scans new Sonic blocks for transactions
2. **DEX Detection**: Identifies transactions sent to supported DEX router contracts
3. **Cashback Calculation**: Applies appropriate cashback rates based on DEX and transaction value
4. **Treasury Distribution**: Calls `WarderTreasury.transferToWallet()` to credit users
5. **Database Storage**: Stores all transaction data for analytics and frontend display

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sonic Chain   │───▶│  Tx Scanner     │───▶│  Warder System  │
│                 │    │                 │    │                 │
│ • Shadow DEX    │    │ • Block Monitor │    │ • Treasury      │
│ • SonicSwap     │    │ • Cashback Calc │    │ • Wallet        │
│ • WAGMI         │    │ • Rate Engine   │    │ • Fee Manager   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │    Database     │
                       │                 │
                       │ • Transactions  │
                       │ • Scanner State │
                       │ • Statistics    │
                       └─────────────────┘
```

## Cashback Rules

- **Base Rates**: 4.2% - 6.5% depending on DEX
- **Minimum Transaction**: 1-5 S depending on DEX  
- **Maximum Cashback**: 200-500 S per transaction
- **Boost Conditions**:
  - Weekend trades: +10-30% boost
  - Large transactions (>100 S): +10-30% boost
  - High volume users: +10-30% boost

## Production Deployment

1. Set `NETWORK=mainnet` in .env
2. Use production MongoDB instance
3. Configure proper logging and monitoring
4. Set up process management (PM2)
5. Configure reverse proxy (Nginx)