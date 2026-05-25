import { Router } from 'express';
import { ethers } from 'ethers';
import { Queue } from 'bullmq';
import { createBullmqConnection } from '../config/bullmqRedis.js';
import { QUEUE_NAMES } from '../config/queues.js';
import { Wallet } from '../models/Wallet.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { decryptPrivateKey, encryptPrivateKey } from '../utils/crypto.js';
import { getOrCreateUserEncryptionKey } from '../utils/userKey.js';

const router = Router();

router.get(
  '/queue-status',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const connection = createBullmqConnection();
    const queue = new Queue(QUEUE_NAMES.BOT_EXECUTION, { connection });
    try {
      const [waiting, active, delayed, failed, completed] = await Promise.all([
        queue.getWaiting(0, 50),
        queue.getActive(0, 50),
        queue.getDelayed(0, 50),
        queue.getFailed(0, 20),
        queue.getCompleted(0, 10),
      ]);

      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused');

      res.json({
        queueName: QUEUE_NAMES.BOT_EXECUTION,
        counts,
        delayed: delayed.map((j) => ({
          id: j.id,
          name: j.name,
          data: j.data,
          processAt: new Date(j.timestamp + (j.opts.delay ?? 0)).toISOString(),
        })),
        waiting: waiting.map((j) => ({ id: j.id, name: j.name, data: j.data })),
        active: active.map((j) => ({ id: j.id, name: j.name, data: j.data })),
        failed: failed.map((j) => ({
          id: j.id,
          data: j.data,
          failedReason: j.failedReason,
          attemptsMade: j.attemptsMade,
        })),
        completed: completed.map((j) => ({ id: j.id, name: j.name, data: j.data })),
      });
    } finally {
      await queue.close();
      await connection.quit();
    }
  })
);

/**
 * GET /api/debug/test-decrypt/:walletId
 * Tests whether the current user's per-user encryption key can decrypt the wallet.
 */
router.get(
  '/test-decrypt/:walletId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { walletId } = req.params;
    const doc = await Wallet.findOne({ _id: walletId, createdBy: req.userId }).select('+encryptedPrivateKey');
    if (!doc) {
      res.status(404).json({ ok: false, error: 'Wallet not found' });
      return;
    }

    const encryptionKey = await getOrCreateUserEncryptionKey(req.userId!);

    try {
      const pk = decryptPrivateKey(doc.encryptedPrivateKey, encryptionKey);
      const derived = new ethers.Wallet(pk).address;
      const match = derived.toLowerCase() === doc.address.toLowerCase();
      res.json({
        ok: true,
        walletId: doc.id,
        storedAddress: doc.address,
        derivedAddress: derived,
        addressMatch: match,
        label: doc.label,
      });
    } catch (err) {
      res.status(422).json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        walletId: doc.id,
        storedAddress: doc.address,
        hint: 'Wallet was encrypted with a different key. Use POST /api/debug/re-encrypt-wallet to fix it.',
      });
    }
  })
);

/**
 * POST /api/debug/re-encrypt-wallet
 * Body: { walletId: string, privateKey: string }
 * Re-encrypts the wallet using the current user's per-user encryption key.
 */
router.post(
  '/re-encrypt-wallet',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { walletId, privateKey } = req.body as { walletId?: string; privateKey?: string };

    if (!walletId || typeof walletId !== 'string') {
      res.status(400).json({ ok: false, error: 'walletId is required' });
      return;
    }
    if (!privateKey || typeof privateKey !== 'string') {
      res.status(400).json({ ok: false, error: 'privateKey is required' });
      return;
    }

    const doc = await Wallet.findOne({ _id: walletId, createdBy: req.userId }).select('+encryptedPrivateKey');
    if (!doc) {
      res.status(404).json({ ok: false, error: 'Wallet not found' });
      return;
    }

    let normalizedKey = privateKey.trim();
    if (!normalizedKey.startsWith('0x')) normalizedKey = `0x${normalizedKey}`;

    let derivedAddress: string;
    try {
      derivedAddress = ethers.getAddress(new ethers.Wallet(normalizedKey).address);
    } catch {
      res.status(400).json({ ok: false, error: 'Invalid private key — cannot derive address' });
      return;
    }

    if (derivedAddress.toLowerCase() !== doc.address.toLowerCase()) {
      res.status(400).json({
        ok: false,
        error: 'Private key does not match stored wallet address',
        storedAddress: doc.address,
        derivedAddress,
      });
      return;
    }

    const encryptionKey = await getOrCreateUserEncryptionKey(req.userId!);
    doc.encryptedPrivateKey = encryptPrivateKey(normalizedKey, encryptionKey);
    await doc.save();

    res.json({
      ok: true,
      walletId: doc.id,
      address: doc.address,
      message: 'Wallet re-encrypted with your per-user encryption key. Bot execution should now succeed.',
    });
  })
);

export default router;
