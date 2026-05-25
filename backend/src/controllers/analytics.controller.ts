import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Bot } from '../models/Bot.js';
import { Transaction } from '../models/Transaction.js';
import { AppError } from '../utils/errors.js';

export async function volumeAnalytics(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

  const from = new Date(String(req.query.from));
  const to = new Date(String(req.query.to));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError('VALIDATION_ERROR', 'Invalid from/to dates', 400);
  }

  const match: Record<string, unknown> = {
    createdBy: new mongoose.Types.ObjectId(userId),
    createdAt: { $gte: from, $lte: to },
    status: 'confirmed',
  };

  if (req.query.botId && typeof req.query.botId === 'string') {
    match.botId = new mongoose.Types.ObjectId(req.query.botId);
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'bots',
        localField: 'botId',
        foreignField: '_id',
        as: 'bot',
      },
    },
    { $unwind: '$bot' },
    {
      $group: {
        _id: '$bot.strategyType',
        volumeWei: { $sum: { $toDouble: '$inputAmount' } },
        count: { $sum: 1 },
      },
    },
  ];

  const rows = await Transaction.aggregate(pipeline);
  res.json({ from, to, byStrategy: rows });
}

export async function summaryAnalytics(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const botCount = await Bot.countDocuments({
    createdBy: new mongoose.Types.ObjectId(userId),
    status: 'active',
  });

  const txToday = await Transaction.find({
    createdBy: new mongoose.Types.ObjectId(userId),
    createdAt: { $gte: start },
  }).lean();

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
  const filter: Record<string, unknown> = {
    createdBy: new mongoose.Types.ObjectId(userId),
  };

  if (typeof req.query.status === 'string') {
    filter.status = req.query.status;
  }
  if (typeof req.query.botId === 'string' && mongoose.isValidObjectId(req.query.botId)) {
    filter.botId = new mongoose.Types.ObjectId(req.query.botId);
  }

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
      botId: t.botId.toString(),
      walletAddress: t.walletAddress,
      side: t.side,
      status: t.status,
      txHash: t.txHash,
      inputAmount: t.inputAmount,
      createdAt: t.createdAt,
    })),
  });
}
