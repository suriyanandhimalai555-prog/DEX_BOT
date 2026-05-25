import { randomBytes } from 'node:crypto';
import type { IBot } from '../models/Bot.js';
import type { IWallet } from '../models/Wallet.js';
import { logger } from '../utils/logger.js';

export interface ExecutionIntent {
  walletId: string;
  walletAddress: string;
  side: 'buy' | 'sell';
  amountIn: bigint;
  slippageBps: number;
  gasPolicy: IBot['gasPolicy'];
  reason: string;
}

function randomBigIntInclusive(min: bigint, max: bigint): bigint {
  if (max <= min) return min;
  const diff = max - min;
  const buf = randomBytes(32);
  const rnd = BigInt(`0x${buf.toString('hex')}`);
  return min + (rnd % (diff + 1n));
}

/** Pure strategy — no blockchain imports. */
export async function generateIntents(
  bot: IBot,
  wallets: IWallet[]
): Promise<ExecutionIntent[]> {
  const min = BigInt(bot.amountMin);
  const max = BigInt(bot.amountMax);
  const intents: ExecutionIntent[] = [];

  if (wallets.length === 0) return intents;

  const pickWallet = (): IWallet => wallets[Math.floor(Math.random() * wallets.length)];

  if (bot.strategyType === 'smooth_buy') {
    if (!bot.buyEnabled) return intents;
    const w = pickWallet();
    const amountIn = randomBigIntInclusive(min, max);
    intents.push({
      walletId: w.id,
      walletAddress: w.address,
      side: 'buy',
      amountIn,
      slippageBps: bot.slippageBps,
      gasPolicy: bot.gasPolicy,
      reason: 'smooth_buy',
    });
    return intents;
  }

  if (bot.strategyType === 'smooth_sell') {
    if (!bot.sellEnabled) return intents;
    const w = pickWallet();
    const amountIn = randomBigIntInclusive(min, max);
    intents.push({
      walletId: w.id,
      walletAddress: w.address,
      side: 'sell',
      amountIn,
      slippageBps: bot.slippageBps,
      gasPolicy: bot.gasPolicy,
      reason: 'smooth_sell',
    });
    return intents;
  }

  // volume_cycle
  if (bot.strategyType === 'volume_cycle') {
    logger.info({
      message: 'volume_cycle strategy parameters',
      botId: String(bot._id),
      walletCount: wallets.length,
      buyEnabled: bot.buyEnabled,
      sellEnabled: bot.sellEnabled,
      amountMin: bot.amountMin,
      amountMax: bot.amountMax,
      quoteToken: bot.quoteToken,
      baseToken: bot.baseToken,
    });
  }

  const sorted = [...wallets].sort((a, b) => a.address.localeCompare(b.address));
  let toggleBuy = true;
  for (const w of sorted) {
    if (toggleBuy && bot.buyEnabled) {
      intents.push({
        walletId: w.id,
        walletAddress: w.address,
        side: 'buy',
        amountIn: randomBigIntInclusive(min, max),
        slippageBps: bot.slippageBps,
        gasPolicy: bot.gasPolicy,
        reason: 'volume_cycle_buy',
      });
    } else if (!toggleBuy && bot.sellEnabled) {
      intents.push({
        walletId: w.id,
        walletAddress: w.address,
        side: 'sell',
        amountIn: randomBigIntInclusive(min, max),
        slippageBps: bot.slippageBps,
        gasPolicy: bot.gasPolicy,
        reason: 'volume_cycle_sell',
      });
    }
    toggleBuy = !toggleBuy;
  }

  return intents;
}
