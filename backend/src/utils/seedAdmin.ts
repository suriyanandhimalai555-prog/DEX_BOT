import bcrypt from 'bcryptjs';
import { getEnv } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { logger } from './logger.js';
import { passwordPolicyMessage } from './passwordPolicy.js';

export async function seedDefaultAdminIfEmpty(): Promise<void> {
  const count = await prisma.user.count();
  if (count > 0) return;

  const env = getEnv();
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    logger.warn('Empty user table and ADMIN_EMAIL/ADMIN_PASSWORD unset — skipping admin seed');
    return;
  }

  if (
    env.ADMIN_EMAIL.toLowerCase() === 'your-admin@example.com' ||
    env.ADMIN_PASSWORD === 'Replace_With_A_Strong_Password1'
  ) {
    logger.warn(
      'ADMIN_EMAIL/ADMIN_PASSWORD still use .env.example placeholders — skipping admin seed'
    );
    return;
  }

  const policyError = passwordPolicyMessage(env.ADMIN_PASSWORD);
  if (policyError) {
    throw new Error(`ADMIN_PASSWORD is too weak to seed admin: ${policyError}`);
  }

  const defaultUsd = env.DEFAULT_TRADE_LIMIT_USD;
  const tradeLimitBNB = defaultUsd / env.BNB_PRICE_FALLBACK_USD;

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await prisma.user.create({
    data: {
      email: env.ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      displayName: 'Administrator',
      role: 'admin',
      isActive: true,
      tradeLimitUSD: defaultUsd,
      tradeLimitBNB,
    },
  });

  logger.warn(
    `Created default admin: ${env.ADMIN_EMAIL} — CHANGE ADMIN_PASSWORD in .env immediately`
  );
}
