import { Redis } from 'ioredis';
import { getEnv } from './env.js';

/**
 * New connection per BullMQ Queue / Worker (do not share one client across both).
 * BullMQ requires maxRetriesPerRequest: null and enableReadyCheck: false.
 */
export function createBullmqConnection(): Redis {
  const { REDIS_URL } = getEnv();
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
