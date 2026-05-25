import { Redis } from 'ioredis';
import { getEnv } from './env.js';
import { logger } from '../utils/logger.js';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const { REDIS_URL } = getEnv();
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    redis.on('error', (err: Error) => {
      logger.error(`Redis client error: ${err.message}`);
    });
    redis.on('connect', () => logger.info('Redis connected'));
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
