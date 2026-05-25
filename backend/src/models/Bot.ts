import mongoose, { Schema, type Document } from 'mongoose';

export type StrategyType = 'smooth_buy' | 'smooth_sell' | 'volume_cycle';
export type DexId = 'pancakeswap' | 'uniswap';
export type DexVersion = 'v2' | 'v3';
export type BotStatus = 'draft' | 'active' | 'paused' | 'stopped' | 'errored';

export interface IBot extends Document {
  name: string;
  strategyType: StrategyType;
  chain: 'bsc';
  dex: DexId;
  dexVersion: DexVersion;
  baseToken: string;
  quoteToken: string;
  walletGroupId: mongoose.Types.ObjectId;
  buyEnabled: boolean;
  sellEnabled: boolean;
  amountMin: string;
  amountMax: string;
  intervalSeconds: number;
  slippageBps: number;
  gasPolicy: {
    mode: 'auto' | 'fixed';
    maxGweiOverride?: number;
  };
  riskPolicy: {
    maxDailyNotionalUSD: number;
    cooldownOnFailureSeconds: number;
    maxConcurrentWallets: number;
  };
  status: BotStatus;
  lastRunAt?: Date;
  consecutiveFailures: number;
  cooldownUntil?: Date;
  dailyNotionalUSD: number;
  dailyNotionalResetAt: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BotSchema = new Schema<IBot>(
  {
    name: { type: String, required: true },
    strategyType: {
      type: String,
      enum: ['smooth_buy', 'smooth_sell', 'volume_cycle'],
      required: true,
    },
    chain: { type: String, enum: ['bsc'], default: 'bsc' },
    dex: { type: String, enum: ['pancakeswap', 'uniswap'], default: 'pancakeswap' },
    dexVersion: { type: String, enum: ['v2', 'v3'], required: true },
    baseToken: { type: String, required: true },
    quoteToken: { type: String, required: true },
    walletGroupId: { type: Schema.Types.ObjectId, ref: 'WalletGroup', required: true },
    buyEnabled: { type: Boolean, default: true },
    sellEnabled: { type: Boolean, default: true },
    amountMin: { type: String, required: true },
    amountMax: { type: String, required: true },
    intervalSeconds: { type: Number, required: true, min: 30 },
    slippageBps: { type: Number, required: true },
    gasPolicy: {
      mode: { type: String, enum: ['auto', 'fixed'], required: true },
      maxGweiOverride: { type: Number },
    },
    riskPolicy: {
      maxDailyNotionalUSD: { type: Number, required: true },
      cooldownOnFailureSeconds: { type: Number, required: true },
      maxConcurrentWallets: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'stopped', 'errored'],
      default: 'draft',
    },
    lastRunAt: { type: Date },
    consecutiveFailures: { type: Number, default: 0 },
    cooldownUntil: { type: Date },
    dailyNotionalUSD: { type: Number, default: 0 },
    dailyNotionalResetAt: { type: Date, default: () => new Date() },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Bot = mongoose.model<IBot>('Bot', BotSchema);
