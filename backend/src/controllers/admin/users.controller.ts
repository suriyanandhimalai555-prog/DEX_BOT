import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../../models/User.js';
import { Bot } from '../../models/Bot.js';
import { LimitRequest } from '../../models/LimitRequest.js';
import { Transaction } from '../../models/Transaction.js';
import { AppError } from '../../utils/errors.js';
import { recalculateUserLimitBNB } from '../../utils/tradeLimit.js';
import { clientIp, logAudit } from '../../services/auditLog.service.js';
import * as authService from '../../services/auth.service.js';

export async function listUsers(_req: Request, res: Response): Promise<void> {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  const result = await Promise.all(
    users.map(async (u) => {
      const pendingRequestCount = await LimitRequest.countDocuments({
        userId: u._id,
        status: 'pending',
      });
      const activeBotCount = await Bot.countDocuments({
        createdBy: u._id,
        status: 'active',
      });
      return {
        id: u._id.toString(),
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
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid user id', 400);
  }
  const user = await User.findById(userId);
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  const requests = await LimitRequest.find({ userId }).sort({ createdAt: -1 }).lean();
  const bots = await Bot.find({ createdBy: userId }).lean();
  const txCount = await Transaction.countDocuments({ createdBy: userId });
  const confirmed = await Transaction.countDocuments({ createdBy: userId, status: 'confirmed' });

  res.json({
    user: authService.toSafeUser(user),
    limitRequests: requests,
    bots,
    stats: { totalTx: txCount, confirmedTx: confirmed },
  });
}

export async function activateUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const user = await User.findByIdAndUpdate(userId, { isActive: true }, { new: true });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
  await logAudit('USER_ACTIVATED', {
    userId: req.userId,
    details: JSON.stringify({ targetUserId: userId }),
    ipAddress: clientIp(req),
  });
  res.json({ user: authService.toSafeUser(user) });
}

export async function deactivateUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const user = await User.findById(userId);
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
  user.isActive = false;
  user.tokenVersion += 1;
  await user.save();
  await logAudit('USER_DEACTIVATED', {
    userId: req.userId,
    details: JSON.stringify({ targetUserId: userId }),
    ipAddress: clientIp(req),
  });
  res.json({ user: authService.toSafeUser(user) });
}

export async function setUserRole(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { role } = req.body as { role: 'admin' | 'trader' };
  if (role !== 'admin' && role !== 'trader') {
    throw new AppError('VALIDATION_ERROR', 'Invalid role', 400);
  }
  const user = await User.findById(userId);
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  if (user.role === 'admin' && role === 'trader') {
    const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
    if (adminCount <= 1) {
      throw new AppError('CONFLICT', 'Cannot demote the last admin', 409);
    }
  }

  user.role = role;
  await user.save();
  await logAudit('USER_ROLE_CHANGED', {
    userId: req.userId,
    details: JSON.stringify({ targetUserId: userId, role }),
    ipAddress: clientIp(req),
  });
  res.json({ user: authService.toSafeUser(user) });
}

export async function overrideUserLimit(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { tradeLimitUSD } = req.body as { tradeLimitUSD: number };
  const { MAX_TRADE_LIMIT_USD } = await import('../../config/env.js').then((m) => m.getEnv());
  if (tradeLimitUSD <= 0 || tradeLimitUSD > MAX_TRADE_LIMIT_USD) {
    throw new AppError('VALIDATION_ERROR', `Limit must be between 0 and ${MAX_TRADE_LIMIT_USD}`, 400);
  }
  const user = await User.findById(userId);
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
  user.tradeLimitUSD = tradeLimitUSD;
  user.tradeLimitBNB = await recalculateUserLimitBNB(userId);
  await logAudit('ADMIN_LIMIT_OVERRIDE', {
    userId: req.userId,
    details: JSON.stringify({ targetUserId: userId, tradeLimitUSD }),
    ipAddress: clientIp(req),
  });
  res.json({ user: authService.toSafeUser(user) });
}
