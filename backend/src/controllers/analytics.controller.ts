import type { Request, Response } from 'express';
import { Prisma, type TxStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { isUuid } from '../utils/ids.js';

export async function volumeAnalytics(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

  const from = new Date(String(req.query.from));
  const to = new Date(String(req.query.to));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError('VALIDATION_ERROR', 'Invalid from/to dates', 400);
  }

  const botId =
    typeof req.query.botId === 'string' && isUuid(req.query.botId) ? req.query.botId : null;

  const rows = await prisma.$queryRaw<
    Array<{ _id: string; volumeWei: unknown; count: number | bigint }>
  >(Prisma.sql`
    SELECT b.strategy_type AS "_id",
           SUM(t.input_amount::numeric) AS "volumeWei",
           COUNT(*)::int AS "count"
    FROM transactions t
    INNER JOIN bots b ON b.id = t.bot_id
    WHERE t.created_by = ${userId}::uuid
      AND t.created_at >= ${from}
      AND t.created_at <= ${to}
      AND t.status = 'confirmed'
      ${botId ? Prisma.sql`AND t.bot_id = ${botId}::uuid` : Prisma.empty}
    GROUP BY b.strategy_type
  `);

  res.json({
    from,
    to,
    byStrategy: rows.map((r) => ({
      _id: r._id,
      volumeWei: r.volumeWei == null ? '0' : String(r.volumeWei),
      count: Number(r.count),
    })),
  });
}

export async function summaryAnalytics(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const botCount = await prisma.bot.count({
    where: { createdBy: userId, status: 'active' },
  });

  const txToday = await prisma.transaction.findMany({
    where: { createdBy: userId, createdAt: { gte: start } },
    select: { status: true, gasSpentBNB: true },
  });

  const total = txToday.length;
  const confirmed = txToday.filter((t) => t.status === 'confirmed').length;
  const successRate = total === 0 ? 0 : Math.round((confirmed / total) * 10_000) / 100;

  let gasSpent = 0;
  for (const t of txToday) {
    if (t.gasSpentBNB) {
      gasSpent += Number(t.gasSpentBNB);
    }
  }

  res.json({
    activeBots: botCount,
    txToday: total,
    successRatePercent: successRate,
    gasSpentBNB: gasSpent,
  });
}

export async function listTransactionsAnalytics(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const where: Prisma.TransactionWhereInput = { createdBy: userId };

  if (typeof req.query.status === 'string') {
    where.status = req.query.status as TxStatus;
  }
  if (typeof req.query.botId === 'string' && isUuid(req.query.botId)) {
    where.botId = req.query.botId;
  }

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
      botId: t.botId,
      walletAddress: t.walletAddress,
      side: t.side,
      status: t.status,
      txHash: t.txHash,
      inputAmount: t.inputAmount,
      createdAt: t.createdAt,
    })),
  });
}
