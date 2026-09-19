import type { Request, Response } from 'express';
import { getAddress } from 'ethers';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { mapBot } from '../db/mappers.js';
import type { IBot } from '../models/Bot.js';
import { AppError } from '../utils/errors.js';
import { requireUuid } from '../utils/ids.js';
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

async function loadOwnedBot(id: string, userId: string): Promise<IBot> {
  requireUuid(id);
  const row = await prisma.bot.findFirst({ where: { id, createdBy: userId } });
  if (!row) throw new AppError('NOT_FOUND', 'Bot not found', 404);
  return mapBot(row);
}

export async function createBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

  const body = req.body as Record<string, unknown>;
  getAddress(String(body.baseToken));
  getAddress(String(body.quoteToken));

  const walletGroupId = requireUuid(String(body.walletGroupId), 'wallet group id');
  const walletGroup = await prisma.walletGroup.findFirst({
    where: { id: walletGroupId, createdBy: userId },
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

  const row = await prisma.bot.create({
    data: {
      name: String(body.name),
      strategyType: body.strategyType as IBot['strategyType'],
      chain: 'bsc',
      dex: body.dex as DexId,
      dexVersion: body.dexVersion as DexVersion,
      baseToken: getAddress(String(body.baseToken)),
      quoteToken: getAddress(String(body.quoteToken)),
      walletGroupId: walletGroup.id,
      buyEnabled: Boolean(body.buyEnabled),
      sellEnabled: Boolean(body.sellEnabled),
      amountMin: String(body.amountMin),
      amountMax: String(body.amountMax),
      intervalSeconds: Number(body.intervalSeconds),
      slippageBps: Number(body.slippageBps),
      gasPolicy: body.gasPolicy as Prisma.InputJsonValue,
      riskPolicy: riskPolicy as unknown as Prisma.InputJsonValue,
      status: 'draft',
      consecutiveFailures: 0,
      createdBy: userId,
    },
  });

  res.status(201).json({ bot: serializeBot(mapBot(row)) });
}

export async function listBots(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const bots = await prisma.bot.findMany({
    where: { createdBy: userId },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ bots: bots.map((b) => serializeBot(mapBot(b))) });
}

export async function getBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const bot = await loadOwnedBot(req.params.id, userId);

  const runs = await prisma.botRun.findMany({
    where: { botId: bot.id },
    orderBy: { startedAt: 'desc' },
    take: 20,
  });

  res.json({
    bot: serializeBot(bot),
    runs: runs.map((r) => ({
      id: r.id,
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
  const bot = await loadOwnedBot(req.params.id, userId);
  if (bot.status !== 'draft' && bot.status !== 'paused') {
    throw new AppError('CONFLICT', 'Bot can only be updated when draft or paused', 409);
  }

  const body = req.body as Record<string, unknown>;
  const data: Prisma.BotUpdateInput = {};

  if (body.name !== undefined) data.name = String(body.name);
  if (body.strategyType !== undefined) {
    data.strategyType = body.strategyType as IBot['strategyType'];
  }
  if (body.dex !== undefined) data.dex = body.dex as DexId;
  const nextDex = (body.dex as DexId | undefined) ?? bot.dex;
  const nextDexVersion = (body.dexVersion as DexVersion | undefined) ?? bot.dexVersion;
  if (body.dexVersion !== undefined) data.dexVersion = body.dexVersion as DexVersion;
  if (nextDex === 'uniswap' && nextDexVersion === 'v3') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Uniswap on BSC only supports V2. Select Uniswap V2 or PancakeSwap V3.',
      400
    );
  }
  if (body.baseToken !== undefined) data.baseToken = getAddress(String(body.baseToken));
  if (body.quoteToken !== undefined) data.quoteToken = getAddress(String(body.quoteToken));
  if (body.walletGroupId !== undefined) {
    const wgId = requireUuid(String(body.walletGroupId), 'wallet group id');
    const wg = await prisma.walletGroup.findFirst({
      where: { id: wgId, createdBy: userId },
    });
    if (!wg) throw new AppError('NOT_FOUND', 'Wallet group not found', 404);
    data.walletGroup = { connect: { id: wg.id } };
  }
  if (body.buyEnabled !== undefined) data.buyEnabled = Boolean(body.buyEnabled);
  if (body.sellEnabled !== undefined) data.sellEnabled = Boolean(body.sellEnabled);
  if (body.amountMin !== undefined) data.amountMin = String(body.amountMin);
  if (body.amountMax !== undefined) data.amountMax = String(body.amountMax);
  if (body.intervalSeconds !== undefined) data.intervalSeconds = Number(body.intervalSeconds);
  if (body.slippageBps !== undefined) data.slippageBps = Number(body.slippageBps);
  if (body.gasPolicy !== undefined) data.gasPolicy = body.gasPolicy as Prisma.InputJsonValue;
  if (body.riskPolicy !== undefined) {
    const user = req.user;
    if (!user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    data.riskPolicy = enforceRiskPolicyForUser(
      body.riskPolicy as RiskPolicyInput,
      user
    ) as unknown as Prisma.InputJsonValue;
  }

  const updated = await prisma.bot.update({ where: { id: bot.id }, data });
  res.json({ bot: serializeBot(mapBot(updated)) });
}

export async function startBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const bot = await loadOwnedBot(req.params.id, userId);
  const startable: readonly string[] = ['draft', 'paused', 'stopped', 'errored'];
  if (!startable.includes(bot.status)) {
    throw new AppError(
      'CONFLICT',
      `Bot cannot be started while status is "${bot.status}". Stop it first if it is active, or use Resume when paused.`,
      409
    );
  }

  const updated = await prisma.bot.update({
    where: { id: bot.id },
    data: { status: 'active', consecutiveFailures: 0 },
  });
  await scheduleBotExecution(updated.id, updated.intervalSeconds);
  emitBotStatus(userId, updated.id, 'active');
  await sendTelegramAlert(userId, `Bot "${updated.name}" started`);
  res.json({ bot: serializeBot(mapBot(updated)) });
}

export async function pauseBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const bot = await loadOwnedBot(req.params.id, userId);
  if (bot.status !== 'active') {
    throw new AppError('CONFLICT', 'Bot is not active', 409);
  }
  const updated = await prisma.bot.update({
    where: { id: bot.id },
    data: { status: 'paused' },
  });
  await cancelBotExecution(updated.id);
  emitBotStatus(userId, updated.id, 'paused');
  await sendTelegramAlert(userId, `Bot "${updated.name}" paused`);
  res.json({ bot: serializeBot(mapBot(updated)) });
}

export async function resumeBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const bot = await loadOwnedBot(req.params.id, userId);
  if (bot.status !== 'paused') {
    throw new AppError('CONFLICT', 'Bot is not paused', 409);
  }
  const updated = await prisma.bot.update({
    where: { id: bot.id },
    data: { status: 'active' },
  });
  await scheduleBotExecution(updated.id, updated.intervalSeconds);
  emitBotStatus(userId, updated.id, 'active');
  await sendTelegramAlert(userId, `Bot "${updated.name}" resumed`);
  res.json({ bot: serializeBot(mapBot(updated)) });
}

export async function stopBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const bot = await loadOwnedBot(req.params.id, userId);
  const updated = await prisma.bot.update({
    where: { id: bot.id },
    data: { status: 'stopped' },
  });
  await cancelBotExecution(updated.id);
  emitBotStatus(userId, updated.id, 'stopped');
  await sendTelegramAlert(userId, `Bot "${updated.name}" stopped`);
  res.json({ bot: serializeBot(mapBot(updated)) });
}

export async function deleteBot(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const bot = await loadOwnedBot(req.params.id, userId);
  if (bot.status === 'active') {
    throw new AppError('CONFLICT', 'Stop the bot before deleting', 409);
  }
  await cancelBotExecution(bot.id);
  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { botId: bot.id } }),
    prisma.botRun.deleteMany({ where: { botId: bot.id } }),
    prisma.bot.delete({ where: { id: bot.id } }),
  ]);
  res.status(204).end();
}

export async function listBotTransactions(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const bot = await loadOwnedBot(req.params.id, userId);

  const where = { botId: bot.id };
  const [total, txs] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({
    total,
    page,
    limit,
    transactions: txs.map((t) => ({
      id: t.id,
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

function serializeBot(bot: IBot): Record<string, unknown> {
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
    walletGroupId: bot.walletGroupId,
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
