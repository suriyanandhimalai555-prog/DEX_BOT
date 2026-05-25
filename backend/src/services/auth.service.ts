import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import { User, type IUser, type UserRole } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { bnbPriceService } from './bnbPrice.service.js';
import { logAudit } from './auditLog.service.js';

export interface SafeUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isTotpEnabled: boolean;
  isActive: boolean;
  tradeLimitUSD: number;
  tradeLimitBNB: number;
  telegramChatId?: string;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function toSafeUser(user: IUser): SafeUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isTotpEnabled: user.isTotpEnabled,
    isActive: user.isActive,
    tradeLimitUSD: user.tradeLimitUSD,
    tradeLimitBNB: user.tradeLimitBNB,
    telegramChatId: user.telegramChatId,
    createdAt: user.createdAt,
  };
}

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new AppError('VALIDATION_ERROR', 'Password must be at least 8 characters', 400);
  }
  if (!/[A-Z]/.test(password)) {
    throw new AppError('VALIDATION_ERROR', 'Password must contain an uppercase letter', 400);
  }
  if (!/[0-9]/.test(password)) {
    throw new AppError('VALIDATION_ERROR', 'Password must contain a number', 400);
  }
}

export function signAccessToken(user: IUser): string {
  const { JWT_ACCESS_SECRET } = getEnv();
  return jwt.sign(
    { sub: user.id, tv: user.tokenVersion },
    JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

export function signRefreshToken(user: IUser): string {
  const { JWT_REFRESH_SECRET } = getEnv();
  return jwt.sign(
    { sub: user.id, refresh: true, tv: user.tokenVersion },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

export function signTokens(user: IUser): AuthTokens {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

export async function register(
  email: string,
  password: string,
  displayName: string,
  ipAddress?: string
): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  validatePassword(password);
  const normalized = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalized });
  if (existing) {
    throw new AppError('CONFLICT', 'Email already registered', 409);
  }

  const userCount = await User.countDocuments();
  const role: UserRole = userCount === 0 ? 'admin' : 'trader';
  const { DEFAULT_TRADE_LIMIT_USD } = getEnv();
  const tradeLimitUSD = DEFAULT_TRADE_LIMIT_USD;
  const tradeLimitBNB = bnbPriceService.usdToBnb(tradeLimitUSD);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    email: normalized,
    passwordHash,
    displayName: displayName.trim(),
    role,
    isActive: true,
    tradeLimitUSD,
    tradeLimitBNB,
    tokenVersion: 0,
  });

  await logAudit('USER_REGISTERED', {
    userId: user.id,
    details: JSON.stringify({ email: normalized, role }),
    ipAddress,
  });

  return { user: toSafeUser(user), tokens: signTokens(user) };
}

export async function login(
  email: string,
  password: string,
  totpCode?: string,
  ipAddress?: string
): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +totpSecret');
  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401);
  }
  if (!user.isActive) {
    throw new AppError('FORBIDDEN', 'Account deactivated', 403);
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401);
  }

  if (user.isTotpEnabled && user.totpSecret) {
    const speakeasy = await import('speakeasy');
    if (!totpCode) {
      throw new AppError('UNAUTHORIZED', 'TOTP code required', 401);
    }
    const ok = speakeasy.default.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1,
    });
    if (!ok) {
      throw new AppError('UNAUTHORIZED', 'Invalid TOTP code', 401);
    }
  }

  await logAudit('USER_LOGIN', { userId: user.id, ipAddress });

  return { user: toSafeUser(user), tokens: signTokens(user) };
}

export async function validateToken(token: string): Promise<IUser> {
  const { JWT_ACCESS_SECRET } = getEnv();
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, JWT_ACCESS_SECRET) as jwt.JwtPayload;
  } catch {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }
  const sub = decoded.sub;
  if (typeof sub !== 'string' || !sub) {
    throw new AppError('UNAUTHORIZED', 'Invalid token', 401);
  }
  const user = await User.findById(sub);
  if (!user || !user.isActive) {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }
  const tv = decoded.tv;
  if (typeof tv === 'number' && tv !== user.tokenVersion) {
    throw new AppError('UNAUTHORIZED', 'Session invalidated', 401);
  }
  return user;
}

export async function validateRefreshToken(token: string): Promise<IUser> {
  const { JWT_REFRESH_SECRET } = getEnv();
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as jwt.JwtPayload & {
    refresh?: boolean;
    tv?: number;
  };
  if (!decoded.refresh || typeof decoded.sub !== 'string') {
    throw new AppError('UNAUTHORIZED', 'Invalid refresh token', 401);
  }
  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw new AppError('UNAUTHORIZED', 'Invalid refresh token', 401);
  }
  if (typeof decoded.tv === 'number' && decoded.tv !== user.tokenVersion) {
    throw new AppError('UNAUTHORIZED', 'Session invalidated', 401);
  }
  return user;
}

export async function getUserById(id: string): Promise<SafeUser | null> {
  const user = await User.findById(id);
  return user ? toSafeUser(user) : null;
}

export { toSafeUser };
