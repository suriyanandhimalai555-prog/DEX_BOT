import bcrypt from 'bcryptjs';
import { getEnv } from '../config/env.js';
import { User } from '../models/User.js';
import { logger } from './logger.js';
export async function seedDefaultAdminIfEmpty(): Promise<void> {
  const count = await User.countDocuments();
  if (count > 0) return;

  const env = getEnv();
  const defaultUsd = env.DEFAULT_TRADE_LIMIT_USD;
  const tradeLimitBNB = defaultUsd / env.BNB_PRICE_FALLBACK_USD;

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await User.create({
    email: env.ADMIN_EMAIL.toLowerCase(),
    passwordHash,
    displayName: 'Administrator',
    role: 'admin',
    isActive: true,
    tradeLimitUSD: defaultUsd,
    tradeLimitBNB,
  });

  logger.warn(
    `Created default admin: ${env.ADMIN_EMAIL} — CHANGE ADMIN_PASSWORD in .env immediately`
  );
}
