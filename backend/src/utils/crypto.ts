import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const PBKDF2_ITERATIONS = 310_000;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

function deriveKey(masterKeyHex: string, salt: Buffer): Buffer {
  const master = Buffer.from(masterKeyHex, 'hex');
  return pbkdf2Sync(master, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts a private key string.
 * @param privateKey  The raw private key (0x-prefixed hex string).
 * @param masterKeyHex  64-char hex string — the user's per-user encryption key.
 * @returns Stored format: base64(iv):base64(salt):base64(ciphertext):base64(authTag)
 */
export function encryptPrivateKey(privateKey: string, masterKeyHex: string): string {
  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(masterKeyHex, salt);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    salt.toString('base64'),
    encrypted.toString('base64'),
    authTag.toString('base64'),
  ].join(':');
}

/**
 * Decrypts a stored private key payload.
 * @param encryptedPayload  Stored format: base64(iv):base64(salt):base64(ciphertext):base64(authTag)
 * @param masterKeyHex  64-char hex string — must be the SAME key used at encrypt time.
 * @throws if payload is malformed or the key does not match (GCM auth tag fail).
 */
export function decryptPrivateKey(encryptedPayload: string | undefined, masterKeyHex: string): string {
  if (encryptedPayload == null || typeof encryptedPayload !== 'string') {
    throw new Error(
      'Wallet encrypted private key is missing from the database row (ensure queries use .select("+encryptedPrivateKey"))'
    );
  }
  const parts = encryptedPayload.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted payload format (expected iv:salt:ciphertext:authTag)');
  }
  const [ivB64, saltB64, cipherB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const salt = Buffer.from(saltB64, 'base64');
  const ciphertext = Buffer.from(cipherB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const key = deriveKey(masterKeyHex, salt);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
