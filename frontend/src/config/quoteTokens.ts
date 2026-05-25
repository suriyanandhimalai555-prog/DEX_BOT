import { getAddress } from 'ethers';

/** Wrapped BNB — used for both “BNB” quote UI and on-chain swaps (backend expects a contract address). */
export const WBNB_BSC = getAddress('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');

export const QUOTE_TOKENS = [
  {
    symbol: 'BNB' as const,
    name: 'BNB',
    address: WBNB_BSC,
    decimals: 18,
    logo: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
    color: '#F0B90B',
    /** Holdings use `NATIVE` or BNB symbol for native balance */
    balanceMatch: 'native' as const,
  },
  {
    symbol: 'USDT' as const,
    name: 'Tether USD',
    address: getAddress('0x55d398326f99059fF775485246999027B3197955'),
    decimals: 18,
    logo: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    color: '#26A17B',
    balanceMatch: 'address' as const,
  },
  {
    symbol: 'USDC' as const,
    name: 'USD Coin',
    address: getAddress('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'),
    decimals: 18,
    logo: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    color: '#2775CA',
    balanceMatch: 'address' as const,
  },
  {
    symbol: 'ETH' as const,
    name: 'Ethereum (BSC)',
    address: getAddress('0x2170Ed0880ac9A755fd29B2688956BD959F933F8'),
    decimals: 18,
    logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    color: '#627EEA',
    balanceMatch: 'address' as const,
  },
  {
    symbol: 'SOL' as const,
    name: 'Solana (BSC)',
    address: getAddress('0x570A5D26f7765Ecb712C0924E4De545B89fD43dF'),
    decimals: 18,
    logo: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    color: '#9945FF',
    balanceMatch: 'address' as const,
  },
  {
    symbol: 'TRX' as const,
    name: 'TRON (BSC)',
    address: getAddress('0x85EAC5Ac2F758618dFa09bDbe0cf174e7d574D5B'),
    decimals: 18,
    logo: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',
    color: '#FF0013',
    balanceMatch: 'address' as const,
  },
] as const;

export type QuoteTokenConfig = (typeof QUOTE_TOKENS)[number];
export type QuoteTokenSymbol = QuoteTokenConfig['symbol'];
