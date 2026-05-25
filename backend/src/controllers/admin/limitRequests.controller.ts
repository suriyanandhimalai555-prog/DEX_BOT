import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { LimitRequest } from '../../models/LimitRequest.js';
import { User } from '../../models/User.js';
import { AppError } from '../../utils/errors.js';
import { bnbPriceService } from '../../services/bnbPrice.service.js';
import { clientIp, logAudit } from '../../services/auditLog.service.js';

async function enrichRequest(req: {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  requestedUSD: number;
  currentUSD: number;
  reason: string;
  status: string;
  adminNote?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  const user = await User.findById(req.userId).select('email displayName');
  return {
    id: req._id.toString(),
    userId: req.userId.toString(),
    userEmail: user?.email,
    userDisplayName: user?.displayName,
    requestedUSD: req.requestedUSD,
    currentUSD: req.currentUSD,
    reason: req.reason,
    status: req.status,
    adminNote: req.adminNote,
    reviewedBy: req.reviewedBy?.toString(),
    reviewedAt: req.reviewedAt,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
  };
}

export async function listLimitRequests(req: Request, res: Response): Promise<void> {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.status === 'string') {
    filter.status = req.query.status;
  }
  if (typeof req.query.userId === 'string' && mongoose.isValidObjectId(req.query.userId)) {
    filter.userId = new mongoose.Types.ObjectId(req.query.userId);
  }
  const rows = await LimitRequest.find(filter)
    .sort({ status: 1, createdAt: -1 })
    .lean();
  const requests = await Promise.all(rows.map((r) => enrichRequest(r)));
  res.json({ requests });
}

export async function pendingCount(_req: Request, res: Response): Promise<void> {
  const count = await LimitRequest.countDocuments({ status: 'pending' });
  res.json({ count });
}

export async function approveRequest(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { adminNote } = req.body as { adminNote?: string };
  const doc = await LimitRequest.findById(id);
  if (!doc) throw new AppError('NOT_FOUND', 'Request not found', 404);
  if (doc.status !== 'pending') {
    throw new AppError('CONFLICT', 'Request is not pending', 409);
  }
  doc.status = 'approved';
  doc.reviewedBy = new mongoose.Types.ObjectId(req.userId!);
  doc.reviewedAt = new Date();
  if (adminNote) doc.adminNote = adminNote;
  await doc.save();

  const user = await User.findById(doc.userId);
  if (user) {
    user.tradeLimitUSD = doc.requestedUSD;
    user.tradeLimitBNB = bnbPriceService.usdToBnb(doc.requestedUSD);
    await user.save();
  }

  await logAudit('LIMIT_REQUEST_APPROVED', {
    userId: req.userId,
    details: JSON.stringify({ requestId: id, requestedUSD: doc.requestedUSD }),
    ipAddress: clientIp(req),
  });

  res.json({ request: await enrichRequest(doc.toObject()) });
}

export async function rejectRequest(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { adminNote } = req.body as { adminNote: string };
  if (!adminNote || adminNote.length < 10) {
    throw new AppError('VALIDATION_ERROR', 'adminNote required (min 10 chars)', 400);
  }
  const doc = await LimitRequest.findById(id);
  if (!doc) throw new AppError('NOT_FOUND', 'Request not found', 404);
  if (doc.status !== 'pending') {
    throw new AppError('CONFLICT', 'Request is not pending', 409);
  }
  doc.status = 'rejected';
  doc.adminNote = adminNote;
  doc.reviewedBy = new mongoose.Types.ObjectId(req.userId!);
  doc.reviewedAt = new Date();
  await doc.save();

  await logAudit('LIMIT_REQUEST_REJECTED', {
    userId: req.userId,
    details: JSON.stringify({ requestId: id }),
    ipAddress: clientIp(req),
  });

  res.json({ request: await enrichRequest(doc.toObject()) });
}
