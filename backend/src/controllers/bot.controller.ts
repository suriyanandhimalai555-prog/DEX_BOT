import type { Request, Response } from 'express';
import { getAddress } from 'ethers';
import mongoose from 'mongoose';
import { Bot } from '../models/Bot.js';
import { BotRun } from '../models/BotRun.js';
import { Transaction } from '../models/Transaction.js';
import { WalletGroup } from '../models/WalletGroup.js';
import { AppError } from '../utils/errors.js';
import {
  cancelBotExecution,
  scheduleBotExecution,
} from '../services/scheduler.service.js';
import { sendTelegramAlert } from '../services/telegram.service.js';
import { emitBotStatus } from '../socket/txStream.js';
import {
  getDexDisplayLabel,
  resolveRouterAddress,
  type DexId,
  type DexVersion,
} from '../config/dex.js';
import { enforceRiskPolicyForUser, type RiskPolicyInput } from '../utils/traderBotRisk.js';

export async function createBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

  const body = req.body as Record<string, unknown>;
  getAddress(String(body.baseToken));
  getAddress(String(body.quoteToken));

  const walletGroup = await WalletGroup.findOne({
    _id: body.walletGroupId,
    createdBy: userId,
  });
  if (!walletGroup) {
    throw new AppError('NOT_FOUND', 'Wallet group not found', 404);
  }

  const user = req.user;
  if (!user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

  const riskPolicy = enforceRiskPolicyForUser(
    body.riskPolicy as RiskPolicyInput,
    user
  );

  const bot = await Bot.create({
    name: body.name,
    strategyType: body.strategyType,
    chain: 'bsc',
    dex: body.dex as DexId,
    dexVersion: body.dexVersion as DexVersion,
    baseToken: getAddress(String(body.baseToken)),
    quoteToken: getAddress(String(body.quoteToken)),
    walletGroupId: walletGroup._id,
    buyEnabled: Boolean(body.buyEnabled),
    sellEnabled: Boolean(body.sellEnabled),
    amountMin: String(body.amountMin),
    amountMax: String(body.amountMax),
    intervalSeconds: Number(body.intervalSeconds),
    slippageBps: Number(body.slippageBps),
    gasPolicy: body.gasPolicy as { mode: 'auto' | 'fixed'; maxGweiOverride?: number },
    riskPolicy,
    status: 'draft',
    consecutiveFailures: 0,
    createdBy: userId,
  });

  res.status(201).json({ bot: serializeBot(bot) });
}

export async function listBots(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const bots = await Bot.find({ createdBy: userId }).sort({ updatedAt: -1 }).lean();
  res.json({ bots: bots.map((b) => serializeBotLean(b)) });
}

export async function getBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid id', 400);
  }
  const bot = await Bot.findOne({ _id: id, createdBy: userId });
  if (!bot) throw new AppError('NOT_FOUND', 'Bot not found', 404);

  const runs = await BotRun.find({ botId: bot._id })
    .sort({ startedAt: -1 })
    .limit(20)
    .lean();

  res.json({
    bot: serializeBot(bot),
    runs: runs.map((r) => ({
      id: r._id.toString(),
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      status: r.status,
      intentCount: r.intentCount,
      successCount: r.successCount,
      failureCount: r.failureCount,
    })),
  });
}

export async function updateBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid id', 400);
  }
  const bot = await Bot.findOne({ _id: id, createdBy: userId });
  if (!bot) throw new AppError('NOT_FOUND', 'Bot not found', 404);
  if (bot.status !== 'draft' && bot.status !== 'paused') {
    throw new AppError('CONFLICT', 'Bot can only be updated when draft or paused', 409);
  }

  const body = req.body as Record<string, unknown>;
  if (body.name !== undefined) bot.name = String(body.name);
  if (body.strategyType !== undefined) bot.strategyType = body.strategyType as typeof bot.strategyType;
  if (body.dex !== undefined) bot.dex = body.dex as DexId;
  if (body.dexVersion !== undefined) bot.dexVersion = body.dexVersion as typeof bot.dexVersion;
  if (bot.dex === 'uniswap' && bot.dexVersion === 'v3') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Uniswap on BSC only supports V2. Select Uniswap V2 or PancakeSwap V3.',
      400
    );
  }
  if (body.baseToken !== undefined) bot.baseToken = getAddress(String(body.baseToken));
  if (body.quoteToken !== undefined) bot.quoteToken = getAddress(String(body.quoteToken));
  if (body.walletGroupId !== undefined) {
    const wg = await WalletGroup.findOne({
      _id: body.walletGroupId,
      createdBy: userId,
    });
    if (!wg) throw new AppError('NOT_FOUND', 'Wallet group not found', 404);
    bot.walletGroupId = wg._id;
  }
  if (body.buyEnabled !== undefined) bot.buyEnabled = Boolean(body.buyEnabled);
  if (body.sellEnabled !== undefined) bot.sellEnabled = Boolean(body.sellEnabled);
  if (body.amountMin !== undefined) bot.amountMin = String(body.amountMin);
  if (body.amountMax !== undefined) bot.amountMax = String(body.amountMax);
  if (body.intervalSeconds !== undefined) bot.intervalSeconds = Number(body.intervalSeconds);
  if (body.slippageBps !== undefined) bot.slippageBps = Number(body.slippageBps);
  if (body.gasPolicy !== undefined) bot.gasPolicy = body.gasPolicy as typeof bot.gasPolicy;
  if (body.riskPolicy !== undefined) {
    const user = req.user;
    if (!user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    bot.riskPolicy = enforceRiskPolicyForUser(body.riskPolicy as RiskPolicyInput, user);
  }

  await bot.save();
  res.json({ bot: serializeBot(bot) });
}

export async function startBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const { id } = req.params;
  const bot = await Bot.findOne({ _id: id, createdBy: userId });
  if (!bot) throw new AppError('NOT_FOUND', 'Bot not found', 404);
  const startable: readonly string[] = ['draft', 'paused', 'stopped', 'errored'];
  if (!startable.includes(bot.status)) {
    throw new AppError(
      'CONFLICT',
      `Bot cannot be started while status is "${bot.status}". Stop it first if it is active, or use Resume when paused.`,
      409
    );
  }

  bot.status = 'active';
  bot.consecutiveFailures = 0;
  await bot.save();
  await scheduleBotExecution(String(bot._id), bot.intervalSeconds);
  emitBotStatus(userId, String(bot._id), 'active');
  await sendTelegramAlert(userId, `Bot "${bot.name}" started`);
  res.json({ bot: serializeBot(bot) });
}

export async function pauseBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const { id } = req.params;
  const bot = await Bot.findOne({ _id: id, createdBy: userId });
  if (!bot) throw new AppError('NOT_FOUND', 'Bot not found', 404);
  if (bot.status !== 'active') {
    throw new AppError('CONFLICT', 'Bot is not active', 409);
  }
  bot.status = 'paused';
  await bot.save();
  await cancelBotExecution(String(bot._id));
  emitBotStatus(userId, String(bot._id), 'paused');
  await sendTelegramAlert(userId, `Bot "${bot.name}" paused`);
  res.json({ bot: serializeBot(bot) });
}

export async function resumeBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const { id } = req.params;
  const bot = await Bot.findOne({ _id: id, createdBy: userId });
  if (!bot) throw new AppError('NOT_FOUND', 'Bot not found', 404);
  if (bot.status !== 'paused') {
    throw new AppError('CONFLICT', 'Bot is not paused', 409);
  }
  bot.status = 'active';
  await bot.save();
  await scheduleBotExecution(String(bot._id), bot.intervalSeconds);
  emitBotStatus(userId, String(bot._id), 'active');
  await sendTelegramAlert(userId, `Bot "${bot.name}" resumed`);
  res.json({ bot: serializeBot(bot) });
}

export async function stopBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const { id } = req.params;
  const bot = await Bot.findOne({ _id: id, createdBy: userId });
  if (!bot) throw new AppError('NOT_FOUND', 'Bot not found', 404);
  bot.status = 'stopped';
  await bot.save();
  await cancelBotExecution(String(bot._id));
  emitBotStatus(userId, String(bot._id), 'stopped');
  await sendTelegramAlert(userId, `Bot "${bot.name}" stopped`);
  res.json({ bot: serializeBot(bot) });
}

export async function deleteBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const { id } = req.params;
  const bot = await Bot.findOne({ _id: id, createdBy: userId });
  if (!bot) throw new AppError('NOT_FOUND', 'Bot not found', 404);
  if (bot.status === 'active') {
    throw new AppError('CONFLICT', 'Stop the bot before deleting', 409);
  }
  await cancelBotExecution(String(bot._id));
  await Transaction.deleteMany({ botId: bot._id });
  await BotRun.deleteMany({ botId: bot._id });
  await bot.deleteOne();
  res.status(204).end();
}

export async function listBotTransactions(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const { id } = req.params;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const bot = await Bot.findOne({ _id: id, createdBy: userId });
  if (!bot) throw new AppError('NOT_FOUND', 'Bot not found', 404);

  const filter = { botId: bot._id };
  const total = await Transaction.countDocuments(filter);
  const txs = await Transaction.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({
    total,
    page,
    limit,
    transactions: txs.map((t) => ({
      id: t._id.toString(),
      walletAddress: t.walletAddress,
      side: t.side,
      inputAmount: t.inputAmount,
      outputAmount: t.outputAmount,
      status: t.status,
      txHash: t.txHash,
      failureCode: t.failureCode,
      quotedPrice: t.quotedPrice,
      executedPrice: t.executedPrice,
      createdAt: t.createdAt,
    })),
  });
}

function serializeBot(bot: InstanceType<typeof Bot>): Record<string, unknown> {
  const dex = (bot.dex ?? 'pancakeswap') as DexId;
  const dexVersion = bot.dexVersion as DexVersion;
  return {
    id: bot.id,
    name: bot.name,
    strategyType: bot.strategyType,
    dex,
    dexVersion,
    dexLabel: getDexDisplayLabel(dex, dexVersion),
    routerAddress: resolveRouterAddress(dex, dexVersion),
    baseToken: bot.baseToken,
    quoteToken: bot.quoteToken,
    walletGroupId: bot.walletGroupId.toString(),
    buyEnabled: bot.buyEnabled,
    sellEnabled: bot.sellEnabled,
    amountMin: bot.amountMin,
    amountMax: bot.amountMax,
    intervalSeconds: bot.intervalSeconds,
    slippageBps: bot.slippageBps,
    gasPolicy: bot.gasPolicy,
    riskPolicy: bot.riskPolicy,
    status: bot.status,
    lastRunAt: bot.lastRunAt,
    consecutiveFailures: bot.consecutiveFailures,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
  };
}

function serializeBotLean(b: Record<string, unknown>): Record<string, unknown> {
  const dex = ((b.dex as DexId | undefined) ?? 'pancakeswap') as DexId;
  const dexVersion = b.dexVersion as DexVersion;
  return {
    id: String(b._id),
    name: b.name,
    strategyType: b.strategyType,
    dex,
    dexVersion,
    dexLabel: getDexDisplayLabel(dex, dexVersion),
    routerAddress: resolveRouterAddress(dex, dexVersion),
    baseToken: b.baseToken,
    quoteToken: b.quoteToken,
    walletGroupId: String(b.walletGroupId),
    buyEnabled: b.buyEnabled,
    sellEnabled: b.sellEnabled,
    amountMin: b.amountMin,
    amountMax: b.amountMax,
    intervalSeconds: b.intervalSeconds,
    slippageBps: b.slippageBps,
    gasPolicy: b.gasPolicy,
    riskPolicy: b.riskPolicy,
    status: b.status,
    lastRunAt: b.lastRunAt,
    consecutiveFailures: b.consecutiveFailures,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}
