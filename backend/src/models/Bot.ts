export type StrategyType = 'smooth_buy' | 'smooth_sell' | 'volume_cycle';
export type DexId = 'pancakeswap' | 'uniswap';
export type DexVersion = 'v2' | 'v3';
export type BotStatus = 'draft' | 'active' | 'paused' | 'stopped' | 'errored';

export interface GasPolicy {
  mode: 'auto' | 'fixed';
  maxGweiOverride?: number;
}

export interface RiskPolicy {
  maxDailyNotionalUSD: number;
  cooldownOnFailureSeconds: number;
  maxConcurrentWallets: number;
}

export interface IBot {
  id: string;
  name: string;
  strategyType: StrategyType;
  chain: 'bsc';
  dex: DexId;
  dexVersion: DexVersion;
  baseToken: string;
  quoteToken: string;
  walletGroupId: string;
  buyEnabled: boolean;
  sellEnabled: boolean;
  amountMin: string;
  amountMax: string;
  intervalSeconds: number;
  slippageBps: number;
  gasPolicy: GasPolicy;
  riskPolicy: RiskPolicy;
  status: BotStatus;
  lastRunAt?: Date | null;
  consecutiveFailures: number;
  cooldownUntil?: Date | null;
  dailyNotionalUSD: number;
  dailyNotionalResetAt: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
