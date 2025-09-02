import { config } from 'dotenv';
config();

export const CONFIG = {
  SONIC_RPC_URL: process.env.SONIC_RPC_URL || 'https://rpc.testnet.soniclabs.com/',
  SONIC_MAINNET_RPC_URL: process.env.SONIC_MAINNET_RPC_URL || 'https://rpc.soniclabs.com/',
  TREASURY_CONTRACT: process.env.TREASURY_CONTRACT || '0x1DC6CEE4D32Cc8B06fC4Cea268ccd774451E08b4',
  WALLET_CONTRACT: process.env.WALLET_CONTRACT || '0xa83F9277F984DF0056E7E690016c1eb4FC5757ca',
  STOKEN_CONTRACT: process.env.STOKEN_CONTRACT || '0x2789213A4725FFF214DF9cA5B2fFe3b446f6A9e5',
  FEE_MANAGER_CONTRACT: process.env.FEE_MANAGER_CONTRACT || '0x7Df5fda5E528ba80E84C3462cA7D7454c5129c7b',
  PRIVATE_KEY: process.env.PRIVATE_KEY || '',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/warder-scanner',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  PORT: parseInt(process.env.PORT || '3001'),
  SCAN_INTERVAL_SECONDS: parseInt(process.env.SCAN_INTERVAL_SECONDS || '30'),
  NETWORK: process.env.NETWORK || 'testnet',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

export const SONIC_CONTRACTS = {
  WRAPPED_S: '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38',
  WETH: '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b',
  USDC: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
  MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11',
  
  SHADOW_ROUTER: '0x1D368773735ee1E678950B7A97bcA2CafB330CDc',
  SHADOW_UNIVERSAL_ROUTER: '0x92643Dc4F75C374b689774160CDea09A0704a9c2',
  SHADOW_V3_FACTORY: '0xcD2d0637c94fe77C2896BbCBB174cefFb08DE6d7',
  SHADOW_TOKEN: '0x3333b97138D4b086720b5aE8A7844b1345a33333',
  
  SONICSWAP_FACTORY: '0x0569F2A6B281b139bC164851cf86E4a792ca6e81',
  SONICSWAP_ROUTER: '0x8885b3cfF909e129d9F8f75b196503F4F8B1A351',
  SONICX_SWAP_TOKEN: '0x008d9c24266e09D26655395bd47B5F53BbCA8AFF',
  
  WAGMI_CONTRACT: '0x92cc36d66e9d739d50673d1f27929a371fb83a67',
  
  TEST_DEX_ROUTER: '0x668A3cf25392Bc6688Cb7C74690b984C05CF1aFF'
};

export const CASHBACK_RULES = [
  {
    contractAddress: SONIC_CONTRACTS.SHADOW_ROUTER,
    dexName: 'Shadow Exchange',
    baseRate: 0.065,
    maxCashback: 500,
    minTransaction: 1,
    isActive: true,
    boostMultiplier: 1.3,
    description: 'Shadow Exchange - Concentrated liquidity DEX'
  },
  {
    contractAddress: SONIC_CONTRACTS.SHADOW_UNIVERSAL_ROUTER,
    dexName: 'Shadow Exchange Universal',
    baseRate: 0.058,
    maxCashback: 500,
    minTransaction: 1,
    isActive: true,
    boostMultiplier: 1.25,
    description: 'Shadow Exchange Universal Router'
  },
  {
    contractAddress: SONIC_CONTRACTS.SONICSWAP_ROUTER,
    dexName: 'SonicSwap',
    baseRate: 0.048,
    maxCashback: 200,
    minTransaction: 2,
    isActive: true,
    boostMultiplier: 1.15,
    description: 'SonicSwap DEX'
  },
  {
    contractAddress: SONIC_CONTRACTS.WAGMI_CONTRACT,
    dexName: 'WAGMI',
    baseRate: 0.042,
    maxCashback: 300,
    minTransaction: 5,
    isActive: true,
    boostMultiplier: 1.1,
    description: 'WAGMI DEX Protocol'
  },
  {
    contractAddress: SONIC_CONTRACTS.TEST_DEX_ROUTER,
    dexName: 'Test DEX',
    baseRate: 0.08,
    maxCashback: 100,
    minTransaction: 0.1,
    isActive: true,
    boostMultiplier: 1.5,
    description: 'Test DEX Router for development'
  }
];

export const TREASURY_ABI = [
  "function transferToWallet(address _studentWallet, uint256 _cashback) external",
  "function getBalance() external view returns (uint256)",
  "function authorizedCallers(address) external view returns (bool)"
];

export const WALLET_ABI = [
  "function creditCashback(address _user, uint256 _amount) external",
  "function cashbackBalances(address) external view returns (uint256)",
  "function totalCashbackHeld() external view returns (uint256)"
];