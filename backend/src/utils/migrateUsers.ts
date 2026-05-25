import { getEnv } from '../config/env.js';
import { User } from '../models/User.js';
import { logger } from './logger.js';

/** Backfill new User fields for documents created before RBAC/limit rollout. */
export async function migrateUserFields(): Promise<void> {
  const { DEFAULT_TRADE_LIMIT_USD, BNB_PRICE_FALLBACK_USD } = getEnv();
  const defaultBnb = DEFAULT_TRADE_LIMIT_USD / BNB_PRICE_FALLBACK_USD;

  const result = await User.updateMany(
    {
      $or: [
        { displayName: { $exists: false } },
        { tradeLimitUSD: { $exists: false } },
        { isActive: { $exists: false } },
      ],
    },
    {
      $set: {
        displayName: 'User',
        isActive: true,
        tradeLimitUSD: DEFAULT_TRADE_LIMIT_USD,
        tradeLimitBNB: defaultBnb,
        tokenVersion: 0,
      },
    }
  );

  if (result.modifiedCount > 0) {
    logger.info(`Migrated ${result.modifiedCount} user documents with new fields`);
  }
}
