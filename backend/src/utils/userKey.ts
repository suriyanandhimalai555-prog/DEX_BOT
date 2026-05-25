import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { User } from '../models/User.js';

/**
 * Returns the per-user AES-256-GCM master key (64-char hex string).
 * If the user doesn't have one yet, generates a random 32-byte key,
 * persists it to the User document, and returns it.
 *
 * This key is the single stable secret that encrypts all wallets for
 * the user. It lives in MongoDB (select: false) and never needs to be
 * set manually in .env.
 */
export async function getOrCreateUserEncryptionKey(
  userId: mongoose.Types.ObjectId | string
): Promise<string> {
  const user = await User.findById(userId).select('+encryptionKey');
  if (!user) {
    throw new Error(`User ${String(userId)} not found — cannot resolve encryption key`);
  }
  if (user.encryptionKey && user.encryptionKey.length === 64) {
    return user.encryptionKey;
  }
  const newKey = randomBytes(32).toString('hex');
  user.encryptionKey = newKey;
  await user.save();
  return newKey;
}
