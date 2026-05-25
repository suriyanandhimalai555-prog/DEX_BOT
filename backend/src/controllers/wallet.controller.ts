import type { Request, Response } from 'express';
import { ethers } from 'ethers';
import mongoose from 'mongoose';
import { Wallet } from '../models/Wallet.js';
import { WalletGroup } from '../models/WalletGroup.js';
import { AppError } from '../utils/errors.js';
import { encryptPrivateKey } from '../utils/crypto.js';
import { getOrCreateUserEncryptionKey } from '../utils/userKey.js';
import { logger } from '../utils/logger.js';

export async function importWallet(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const { privateKey, label } = req.body as { privateKey: string; label: string };
  let normalizedKey = privateKey.trim();
  if (!normalizedKey.startsWith('0x')) {
    normalizedKey = `0x${normalizedKey}`;
  }
  let walletAddr: string;
  try {
    walletAddr = ethers.getAddress(new ethers.Wallet(normalizedKey).address);
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Invalid private key', 400);
  }
  const userEncryptionKey = await getOrCreateUserEncryptionKey(userId);
  const encryptedPrivateKey = encryptPrivateKey(normalizedKey, userEncryptionKey);
  const existing = await Wallet.findOne({ address: walletAddr, createdBy: userId });
  if (existing) {
    throw new AppError('CONFLICT', 'Wallet already imported', 409);
  }
  const doc = await Wallet.create({
    label,
    address: walletAddr,
    encryptedPrivateKey,
    chain: 'bsc',
    status: 'active',
    nativeBalance: '0',
    dailySpentNotional: 0,
    activeBotCount: 0,
    createdBy: userId,
  });
  logger.info(`Wallet imported id=${doc.id} address=${walletAddr}`);
  res.status(201).json({
    wallet: {
      id: doc.id,
      label: doc.label,
      address: doc.address,
      chain: doc.chain,
      status: doc.status,
      nativeBalance: doc.nativeBalance,
      dailySpentNotional: doc.dailySpentNotional,
      activeBotCount: doc.activeBotCount,
      walletGroupId: doc.walletGroupId,
      lastExecutedAt: doc.lastExecutedAt,
      createdAt: doc.createdAt,
    },
  });
}

export async function listWallets(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const wallets = await Wallet.find({ createdBy: userId }).sort({ createdAt: -1 }).lean();
  res.json({
    wallets: wallets.map((w) => ({
      id: w._id.toString(),
      label: w.label,
      address: w.address,
      chain: w.chain,
      status: w.status,
      nativeBalance: w.nativeBalance,
      dailySpentNotional: w.dailySpentNotional,
      activeBotCount: w.activeBotCount,
      walletGroupId: w.walletGroupId?.toString(),
      lastExecutedAt: w.lastExecutedAt,
      createdAt: w.createdAt,
    })),
  });
}

export async function deleteWallet(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid wallet id', 400);
  }
  const w = await Wallet.findOne({ _id: id, createdBy: userId });
  if (!w) {
    throw new AppError('NOT_FOUND', 'Wallet not found', 404);
  }
  if (w.activeBotCount > 0) {
    throw new AppError('CONFLICT', 'Wallet has active bots', 409);
  }
  await WalletGroup.updateMany({ createdBy: userId }, { $pull: { walletIds: w._id } });
  await w.deleteOne();
  res.status(204).end();
}

export async function createGroup(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const { name, walletIds } = req.body as { name: string; walletIds: string[] };
  const ids = walletIds.map((id) => {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError('VALIDATION_ERROR', `Invalid wallet id: ${id}`, 400);
    }
    return new mongoose.Types.ObjectId(id);
  });
  const count = await Wallet.countDocuments({
    _id: { $in: ids },
    createdBy: userId,
  });
  if (count !== ids.length) {
    throw new AppError('FORBIDDEN', 'One or more wallets not found', 403);
  }
  const group = await WalletGroup.create({
    name,
    walletIds: ids,
    createdBy: userId,
  });
  res.status(201).json({
    group: {
      id: group.id,
      name: group.name,
      walletIds: group.walletIds.map((x) => x.toString()),
      createdAt: group.createdAt,
    },
  });
}

export async function listGroups(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const groups = await WalletGroup.find({ createdBy: userId }).sort({ createdAt: -1 }).lean();
  res.json({
    groups: groups.map((g) => ({
      id: g._id.toString(),
      name: g.name,
      walletIds: g.walletIds.map((x) => x.toString()),
      createdAt: g.createdAt,
    })),
  });
}
