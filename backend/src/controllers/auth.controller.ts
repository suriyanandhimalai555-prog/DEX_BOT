import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import speakeasy from 'speakeasy';
import { getEnv } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import * as authService from '../services/auth.service.js';
import { clientIp, logAudit } from '../services/auditLog.service.js';

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';
const ACCESS_MAX_MS = 15 * 60 * 1000;
const REFRESH_MAX_MS = 7 * 24 * 60 * 60 * 1000;

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const { NODE_ENV } = getEnv();
  const secure = NODE_ENV === 'production';
  const sameSite = 'lax' as const;
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: ACCESS_MAX_MS,
    path: '/',
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: REFRESH_MAX_MS,
    path: '/',
  });
}

function clearAuthCookies(res: Response): void {
  const { NODE_ENV } = getEnv();
  const secure = NODE_ENV === 'production';
  res.clearCookie(ACCESS_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, displayName } = req.body as {
    email: string;
    password: string;
    displayName: string;
  };
  const { user, tokens } = await authService.register(
    email,
    password,
    displayName,
    clientIp(req)
  );
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  logger.info(`User registered userId=${user.id} role=${user.role}`);
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, totpCode } = req.body as {
    email: string;
    password: string;
    totpCode?: string;
  };
  const { user, tokens } = await authService.login(
    email,
    password,
    totpCode,
    clientIp(req)
  );
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  logger.info(`User logged in userId=${user.id}`);
  res.json({ user });
}

export async function checkAuth(req: Request, res: Response): Promise<void> {
  const token =
    req.cookies?.[ACCESS_COOKIE] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined);
  if (!token) {
    res.json({ authenticated: false });
    return;
  }
  try {
    const user = await authService.validateToken(token);
    res.json({
      authenticated: true,
      user: authService.toSafeUser(user),
      role: user.role,
    });
  } catch {
    res.json({ authenticated: false });
  }
}

export async function setup2fa(_req: Request, res: Response): Promise<void> {
  const userId = _req.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const secret = speakeasy.generateSecret({
    name: `DEX Bot (${userId})`,
  });
  await User.findByIdAndUpdate(userId, {
    totpSecret: secret.base32,
    isTotpEnabled: false,
  });
  const otpauthUrl = secret.otpauth_url ?? '';
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  res.json({
    qrCodeUrl: qrCodeDataUrl,
    secret: secret.base32,
  });
}

export async function verify2fa(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const { token } = req.body as { token: string };
  const user = await User.findById(userId).select('+totpSecret');
  if (!user?.totpSecret) {
    throw new AppError('VALIDATION_ERROR', 'Run 2FA setup first', 400);
  }
  const ok = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: 'base32',
    token,
    window: 1,
  });
  if (!ok) {
    throw new AppError('VALIDATION_ERROR', 'Invalid TOTP token', 400);
  }
  user.isTotpEnabled = true;
  await user.save();
  res.json({ enabled: true });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!refreshToken) {
    throw new AppError('UNAUTHORIZED', 'Refresh token missing', 401);
  }
  try {
    const user = await authService.validateRefreshToken(refreshToken);
    const tokens = authService.signTokens(user);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.json({ ok: true });
  } catch {
    clearAuthCookies(res);
    throw new AppError('UNAUTHORIZED', 'Invalid refresh token', 401);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  if (req.userId) {
    await logAudit('USER_LOGOUT', { userId: req.userId, ipAddress: clientIp(req) });
  }
  clearAuthCookies(res);
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  if (req.user) {
    res.json({ user: authService.toSafeUser(req.user) });
    return;
  }
  const userId = req.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const user = await authService.getUserById(userId);
  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }
  res.json({ user });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const { telegramChatId } = req.body as { telegramChatId?: string };
  await User.findByIdAndUpdate(userId, {
    ...(telegramChatId !== undefined ? { telegramChatId } : {}),
  });
  res.json({ ok: true });
}
