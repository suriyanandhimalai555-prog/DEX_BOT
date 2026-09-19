import { logger } from '../utils/logger.js';
import { prisma } from './prisma.js';

export async function connectDb(): Promise<void> {
  await prisma.$connect();
  logger.info('PostgreSQL connected');
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  logger.info('PostgreSQL disconnected');
}
