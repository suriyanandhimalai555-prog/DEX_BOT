import type { Request, Response } from 'express';
import { AuditLog } from '../../models/AuditLog.js';
import { Transaction } from '../../models/Transaction.js';

export async function listLogs(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

  const auditTotal = await AuditLog.countDocuments();
  const audit = await AuditLog.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const failedTx = await Transaction.find({ status: 'failed' })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('botId walletAddress failureCode failureReason createdAt createdBy')
    .lean();

  res.json({
    audit: { total: auditTotal, page, limit, entries: audit },
    recentFailedTransactions: failedTx,
  });
}
