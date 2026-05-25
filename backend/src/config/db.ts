import dns from 'node:dns';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { getEnv } from './env.js';

function applyMongoDnsServers(serversCsv: string | undefined): void {
  if (!serversCsv) return;
  const servers = serversCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!servers.length) return;
  dns.setServers(servers);
  logger.info(`MongoDB SRV lookups using DNS servers: ${servers.join(', ')}`);
}

export async function connectDb(): Promise<void> {
  const { MONGODB_URI, MONGODB_DNS_SERVERS } = getEnv();
  applyMongoDnsServers(MONGODB_DNS_SERVERS);
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(MONGODB_URI);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('querySrv') && msg.includes('ECONNREFUSED')) {
      logger.error(
        'MongoDB SRV DNS lookup failed (common on Windows when the system resolver rejects SRV queries). ' +
          'Add to backend/.env: MONGODB_DNS_SERVERS=8.8.8.8,8.8.4.4 — or set Windows DNS to a public resolver — ' +
          'or replace mongodb+srv:// with the standard mongodb:// connection string from Atlas.'
      );
    }
    throw err;
  }
  logger.info('MongoDB connected');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
