import type { RequestHandler } from 'express';
import { AppError } from '../utils/errors.js';
import * as authService from '../services/auth.service.js';

const ACCESS_COOKIE = 'accessToken';

function extractToken(req: Parameters<RequestHandler>[0]): string | undefined {
  return (
    req.cookies?.[ACCESS_COOKIE] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined)
  );
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
    return;
  }
  try {
    const user = await authService.validateToken(token);
    req.userId = user.id;
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
    return;
  }
  if (req.user.role !== 'admin') {
    next(new AppError('FORBIDDEN', 'Admin access required', 403));
    return;
  }
  next();
};

/** Traders and admins may access trader routes; observers get 403. */
export const requireTrader: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
    return;
  }
  if (req.user.role === 'observer') {
    next(new AppError('FORBIDDEN', 'Trader access required', 403));
    return;
  }
  next();
};

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const user = await authService.validateToken(token);
    req.userId = user.id;
    req.user = user;
  } catch {
    /* ignore invalid token for optional auth */
  }
  next();
};
