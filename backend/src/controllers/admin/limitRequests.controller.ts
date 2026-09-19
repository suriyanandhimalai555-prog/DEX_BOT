import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import type { ILimitRequest } from '../../models/LimitRequest.js';
import { AppError } from '../../utils/errors.js';
import { isUuid, requireUuid } from '../../utils/ids.js';
import { bnbPriceService } from '../../services/bnbPrice.service.js';
import { clientIp, logAudit } from '../../services/auditLog.service.js';

async function enrichRequest(req: ILimitRequest) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { email: true, displayName: true },
  });
  return {
    id: req.id,
    userId: req.userId,
    userEmail: user?.email,
    userDisplayName: user?.displayName,
    requestedUSD: req.requestedUSD,
    currentUSD: req.currentUSD,
    reason: req.reason,
    status: req.status,
    adminNote: req.adminNote,
    reviewedBy: req.reviewedBy ?? undefined,
    reviewedAt: req.reviewedAt,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
  };
}

export async function listLimitRequests(req: Request, res: Response): Promise<void> {
  const where: { status?: ILimitRequest['status']; userId?: string } = {};
  if (typeof req.query.status === 'string') {
    where.status = req.query.status as ILimitRequest['status'];
  }
  if (typeof req.query.userId === 'string' && isUuid(req.query.userId)) {
    where.userId = req.query.userId;
  }
  const rows = await prisma.limitRequest.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  const requests = await Promise.all(rows.map((r) => enrichRequest(r)));
  res.json({ requests });
}

export async function pendingCount(_req: Request, res: Response): Promise<void> {
  const count = await prisma.limitRequest.count({ where: { status: 'pending' } });
  res.json({ count });
}

export async function approveRequest(req: Request, res: Response): Promise<void> {
  const id = requireUuid(req.params.id);
  const { adminNote } = req.body as { adminNote?: string };
  const doc = await prisma.limitRequest.findUnique({ where: { id } });
  if (!doc) throw new AppError('NOT_FOUND', 'Request not found', 404);
  if (doc.status !== 'pending') {
    throw new AppError('CONFLICT', 'Request is not pending', 409);
  }
  const updated = await prisma.limitRequest.update({
    where: { id },
    data: {
      status: 'approved',
      reviewedBy: req.userId!,
      reviewedAt: new Date(),
      ...(adminNote ? { adminNote } : {}),
    },
  });

  await prisma.user.update({
    where: { id: updated.userId },
    data: {
      tradeLimitUSD: updated.requestedUSD,
      tradeLimitBNB: bnbPriceService.usdToBnb(updated.requestedUSD),
    },
  });

  await logAudit('LIMIT_REQUEST_APPROVED', {
    userId: req.userId,
    details: JSON.stringify({ requestId: id, requestedUSD: updated.requestedUSD }),
    ipAddress: clientIp(req),
  });

  res.json({ request: await enrichRequest(updated) });
}

export async function rejectRequest(req: Request, res: Response): Promise<void> {
  const id = requireUuid(req.params.id);
  const { adminNote } = req.body as { adminNote: string };
  if (!adminNote || adminNote.length < 10) {
    throw new AppError('VALIDATION_ERROR', 'adminNote required (min 10 chars)', 400);
  }
  const doc = await prisma.limitRequest.findUnique({ where: { id } });
  if (!doc) throw new AppError('NOT_FOUND', 'Request not found', 404);
  if (doc.status !== 'pending') {
    throw new AppError('CONFLICT', 'Request is not pending', 409);
  }
  const updated = await prisma.limitRequest.update({
    where: { id },
    data: {
      status: 'rejected',
      adminNote,
      reviewedBy: req.userId!,
      reviewedAt: new Date(),
    },
  });

  await logAudit('LIMIT_REQUEST_REJECTED', {
    userId: req.userId,
    details: JSON.stringify({ requestId: id }),
    ipAddress: clientIp(req),
  });

  res.json({ request: await enrichRequest(updated) });
}
