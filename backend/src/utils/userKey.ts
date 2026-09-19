import { randomBytes } from 'node:crypto';
import { prisma } from '../config/prisma.js';

/**
 * Returns the per-user AES-256-GCM master key (64-char hex string).
 * If the user doesn't have one yet, generates a random 32-byte key,
 * persists it to the user row, and returns it.
 *
 * This key is the single stable secret that encrypts all wallets for
 * the user. It lives in Postgres and never needs to be set manually in .env.
 */
export async function getOrCreateUserEncryptionKey(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { encryptionKey: true },
  });
  if (!user) {
    throw new Error(`User ${userId} not found — cannot resolve encryption key`);
  }
  if (user.encryptionKey && user.encryptionKey.length === 64) {
    return user.encryptionKey;
  }
  const newKey = randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: userId },
    data: { encryptionKey: newKey },
  });
  return newKey;
}
