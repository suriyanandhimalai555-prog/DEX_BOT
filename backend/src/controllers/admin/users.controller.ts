import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { mapBot, mapUser, userPublicSelect } from '../../db/mappers.js';
import { AppError } from '../../utils/errors.js';
import { requireUuid } from '../../utils/ids.js';
import { recalculateUserLimitBNB } from '../../utils/tradeLimit.js';
import { clientIp, logAudit } from '../../services/auditLog.service.js';
import * as authService from '../../services/auth.service.js';

export async function listUsers(_req: Request, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: userPublicSelect,
  });
  const result = await Promise.all(
    users.map(async (u) => {
      const [pendingRequestCount, activeBotCount] = await Promise.all([
        prisma.limitRequest.count({ where: { userId: u.id, status: 'pending' } }),
        prisma.bot.count({ where: { createdBy: u.id, status: 'active' } }),
      ]);
      return {
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        isActive: u.isActive,
        tradeLimitUSD: u.tradeLimitUSD,
        tradeLimitBNB: u.tradeLimitBNB,
        pendingRequestCount,
        activeBotCount,
        createdAt: u.createdAt,
      };
    })
  );
  res.json({ users: result });
}

export async function getUser(req: Request, res: Response): Promise<void> {
  const userId = requireUuid(req.params.userId, 'user id');
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: userPublicSelect,
  });
  if (!row) throw new AppError('NOT_FOUND', 'User not found', 404);

  const [requests, bots, txCount, confirmed] = await Promise.all([
    prisma.limitRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.bot.findMany({ where: { createdBy: userId } }),
    prisma.transaction.count({ where: { createdBy: userId } }),
    prisma.transaction.count({ where: { createdBy: userId, status: 'confirmed' } }),
  ]);

  res.json({
    user: authService.toSafeUser(mapUser(row)),
    limitRequests: requests.map((r) => ({
      id: r.id,
      userId: r.userId,
      requestedUSD: r.requestedUSD,
      currentUSD: r.currentUSD,
      reason: r.reason,
      status: r.status,
      adminNote: r.adminNote,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    bots: bots.map((b) => serializeAdminBot(mapBot(b))),
    stats: { totalTx: txCount, confirmedTx: confirmed },
  });
}

export async function activateUser(req: Request, res: Response): Promise<void> {
  const userId = requireUuid(req.params.userId, 'user id');
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: userPublicSelect,
  });
  if (!row) throw new AppError('NOT_FOUND', 'User not found', 404);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
    select: userPublicSelect,
  });
  await logAudit('USER_ACTIVATED', {
    userId: req.userId,
    details: JSON.stringify({ targetUserId: userId }),
    ipAddress: clientIp(req),
  });
  res.json({ user: authService.toSafeUser(mapUser(user)) });
}

export async function deactivateUser(req: Request, res: Response): Promise<void> {
  const userId = requireUuid(req.params.userId, 'user id');
  const row = await prisma.user.findUnique({ where: { id: userId } });
  if (!row) throw new AppError('NOT_FOUND', 'User not found', 404);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false, tokenVersion: { increment: 1 } },
    select: userPublicSelect,
  });
  await logAudit('USER_DEACTIVATED', {
    userId: req.userId,
    details: JSON.stringify({ targetUserId: userId }),
    ipAddress: clientIp(req),
  });
  res.json({ user: authService.toSafeUser(mapUser(user)) });
}

export async function setUserRole(req: Request, res: Response): Promise<void> {
  const userId = requireUuid(req.params.userId, 'user id');
  const { role } = req.body as { role: 'admin' | 'trader' };
  if (role !== 'admin' && role !== 'trader') {
    throw new AppError('VALIDATION_ERROR', 'Invalid role', 400);
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  if (user.role === 'admin' && role === 'trader') {
    const adminCount = await prisma.user.count({
      where: { role: 'admin', isActive: true },
    });
    if (adminCount <= 1) {
      throw new AppError('CONFLICT', 'Cannot demote the last admin', 409);
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: userPublicSelect,
  });
  await logAudit('USER_ROLE_CHANGED', {
    userId: req.userId,
    details: JSON.stringify({ targetUserId: userId, role }),
    ipAddress: clientIp(req),
  });
  res.json({ user: authService.toSafeUser(mapUser(updated)) });
}

export async function overrideUserLimit(req: Request, res: Response): Promise<void> {
  const userId = requireUuid(req.params.userId, 'user id');
  const { tradeLimitUSD } = req.body as { tradeLimitUSD: number };
  const { MAX_TRADE_LIMIT_USD } = await import('../../config/env.js').then((m) => m.getEnv());
  if (tradeLimitUSD <= 0 || tradeLimitUSD > MAX_TRADE_LIMIT_USD) {
    throw new AppError('VALIDATION_ERROR', `Limit must be between 0 and ${MAX_TRADE_LIMIT_USD}`, 400);
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
  await prisma.user.update({
    where: { id: userId },
    data: { tradeLimitUSD },
  });
  await recalculateUserLimitBNB(userId);
  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: userPublicSelect,
  });
  await logAudit('ADMIN_LIMIT_OVERRIDE', {
    userId: req.userId,
    details: JSON.stringify({ targetUserId: userId, tradeLimitUSD }),
    ipAddress: clientIp(req),
  });
  res.json({ user: authService.toSafeUser(mapUser(updated)) });
}

function serializeAdminBot(b: ReturnType<typeof mapBot>) {
  return {
    id: b.id,
    name: b.name,
    strategyType: b.strategyType,
    status: b.status,
    dex: b.dex,
    dexVersion: b.dexVersion,
    createdBy: b.createdBy,
    lastRunAt: b.lastRunAt,
    createdAt: b.createdAt,
  };
}
