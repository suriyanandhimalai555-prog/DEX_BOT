import type { RequestHandler } from 'express';
import speakeasy from 'speakeasy';
import { User } from '../models/User.js';
import { AppError } from '../utils/errors.js';

/**
 * Requires authenticated user with 2FA enabled and valid totpCode in body.
 */
export const requireTotpForAction: RequestHandler = async (req, _res, next) => {
  const userId = req.userId;
  if (!userId) {
    next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
    return;
  }
  const user = await User.findById(userId).select('+totpSecret +passwordHash');
  if (!user) {
    next(new AppError('NOT_FOUND', 'User not found', 404));
    return;
  }
  if (!user.isTotpEnabled || !user.totpSecret) {
    next(new AppError('FORBIDDEN', 'Two-factor authentication must be enabled', 403));
    return;
  }
  const totpCode = (req.body as { totpCode?: string }).totpCode;
  if (!totpCode || typeof totpCode !== 'string') {
    next(new AppError('VALIDATION_ERROR', 'totpCode is required', 400));
    return;
  }
  const ok = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: 'base32',
    token: totpCode,
    window: 1,
  });
  if (!ok) {
    next(new AppError('FORBIDDEN', 'Invalid TOTP code', 403));
    return;
  }
  next();
};
