import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';

export async function listLogs(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

  const [auditTotal, audit, failedTx] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        botId: true,
        walletAddress: true,
        failureCode: true,
        failureReason: true,
        createdAt: true,
        createdBy: true,
      },
    }),
  ]);

  res.json({
    audit: {
      total: auditTotal,
      page,
      limit,
      entries: audit.map((e) => ({
        id: e.id,
        _id: e.id,
        userId: e.userId,
        action: e.action,
        details: e.details,
        ipAddress: e.ipAddress,
        createdAt: e.createdAt,
      })),
    },
    recentFailedTransactions: failedTx.map((t) => ({
      id: t.id,
      _id: t.id,
      botId: t.botId,
      walletAddress: t.walletAddress,
      failureCode: t.failureCode,
      failureReason: t.failureReason,
      createdAt: t.createdAt,
      createdBy: t.createdBy,
    })),
  });
}
