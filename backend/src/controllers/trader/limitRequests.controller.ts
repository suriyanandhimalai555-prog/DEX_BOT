import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import type { ILimitRequest } from '../../models/LimitRequest.js';
import { AppError } from '../../utils/errors.js';
import { requireUuid } from '../../utils/ids.js';
import { getEnv } from '../../config/env.js';
import { clientIp, logAudit } from '../../services/auditLog.service.js';
import { bnbPriceService } from '../../services/bnbPrice.service.js';

function serializeRequest(doc: ILimitRequest) {
  return {
    id: doc.id,
    userId: doc.userId,
    requestedUSD: doc.requestedUSD,
    currentUSD: doc.currentUSD,
    reason: doc.reason,
    status: doc.status,
    adminNote: doc.adminNote,
    reviewedBy: doc.reviewedBy ?? undefined,
    reviewedAt: doc.reviewedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function submitRequest(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const { requestedUSD, reason } = req.body as { requestedUSD: number; reason: string };
  const { MAX_TRADE_LIMIT_USD } = getEnv();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  if (requestedUSD <= user.tradeLimitUSD) {
    throw new AppError('VALIDATION_ERROR', 'Requested amount must exceed current limit', 400);
  }
  if (requestedUSD > MAX_TRADE_LIMIT_USD) {
    throw new AppError('VALIDATION_ERROR', `Maximum request is $${MAX_TRADE_LIMIT_USD}`, 400);
  }
  if (!reason || reason.trim().length < 20) {
    throw new AppError('VALIDATION_ERROR', 'Reason must be at least 20 characters', 400);
  }

  const pending = await prisma.limitRequest.findFirst({
    where: { userId, status: 'pending' },
  });
  if (pending) {
    throw new AppError('CONFLICT', 'You already have a pending request', 409);
  }

  const doc = await prisma.limitRequest.create({
    data: {
      userId,
      requestedUSD,
      currentUSD: user.tradeLimitUSD,
      reason: reason.trim(),
      status: 'pending',
    },
  });

  await logAudit('LIMIT_REQUEST_SUBMITTED', {
    userId,
    details: JSON.stringify({ requestId: doc.id, requestedUSD }),
    ipAddress: clientIp(req),
  });

  res.status(201).json({ request: serializeRequest(doc) });
}

export async function listMyRequests(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const rows = await prisma.limitRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ requests: rows.map(serializeRequest) });
}

export async function getMyRequest(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const id = requireUuid(req.params.id);
  const doc = await prisma.limitRequest.findFirst({ where: { id, userId } });
  if (!doc) throw new AppError('NOT_FOUND', 'Request not found', 404);
  res.json({ request: serializeRequest(doc) });
}

export async function cancelRequest(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const id = requireUuid(req.params.id);
  const doc = await prisma.limitRequest.findFirst({ where: { id, userId } });
  if (!doc) throw new AppError('NOT_FOUND', 'Request not found', 404);
  if (doc.status !== 'pending') {
    throw new AppError('CONFLICT', 'Only pending requests can be cancelled', 409);
  }
  await prisma.limitRequest.delete({ where: { id } });
  res.status(204).end();
}

/** Public helper for login page */
export function bnbPricePublic(_req: Request, res: Response): void {
  res.json({
    ...bnbPriceService.getStatus(),
    updatedAt: bnbPriceService.getStatus().lastFetchAt,
  });
}
