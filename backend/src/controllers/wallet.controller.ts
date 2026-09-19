import type { Request, Response } from 'express';
import { ethers } from 'ethers';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { encryptPrivateKey } from '../utils/crypto.js';
import { getOrCreateUserEncryptionKey } from '../utils/userKey.js';
import { logger } from '../utils/logger.js';
import { requireUuid } from '../utils/ids.js';

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
  const existing = await prisma.wallet.findFirst({
    where: { address: walletAddr, createdBy: userId },
  });
  if (existing) {
    throw new AppError('CONFLICT', 'Wallet already imported', 409);
  }
  const doc = await prisma.wallet.create({
    data: {
      label,
      address: walletAddr,
      encryptedPrivateKey,
      chain: 'bsc',
      status: 'active',
      nativeBalance: '0',
      dailySpentNotional: 0,
      activeBotCount: 0,
      createdBy: userId,
    },
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
  const wallets = await prisma.wallet.findMany({
    where: { createdBy: userId },
    orderBy: { createdAt: 'desc' },
    omit: { encryptedPrivateKey: true },
  });
  res.json({
    wallets: wallets.map((w) => ({
      id: w.id,
      label: w.label,
      address: w.address,
      chain: w.chain,
      status: w.status,
      nativeBalance: w.nativeBalance,
      dailySpentNotional: w.dailySpentNotional,
      activeBotCount: w.activeBotCount,
      walletGroupId: w.walletGroupId ?? undefined,
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
  const id = requireUuid(req.params.id, 'wallet id');
  const w = await prisma.wallet.findFirst({
    where: { id, createdBy: userId },
    omit: { encryptedPrivateKey: true },
  });
  if (!w) {
    throw new AppError('NOT_FOUND', 'Wallet not found', 404);
  }
  if (w.activeBotCount > 0) {
    throw new AppError('CONFLICT', 'Wallet has active bots', 409);
  }
  const txCount = await prisma.transaction.count({ where: { walletId: id } });
  if (txCount > 0) {
    throw new AppError('CONFLICT', 'Wallet has transaction history', 409);
  }
  await prisma.$transaction([
    prisma.walletGroupMember.deleteMany({ where: { walletId: id } }),
    prisma.wallet.delete({ where: { id } }),
  ]);
  res.status(204).end();
}

export async function createGroup(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const { name, walletIds } = req.body as { name: string; walletIds: string[] };
  const ids = walletIds.map((id) => requireUuid(id, 'wallet id'));
  const count = await prisma.wallet.count({
    where: { id: { in: ids }, createdBy: userId },
  });
  if (count !== ids.length) {
    throw new AppError('FORBIDDEN', 'One or more wallets not found', 403);
  }
  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.walletGroup.create({
      data: { name, createdBy: userId },
    });
    if (ids.length > 0) {
      await tx.walletGroupMember.createMany({
        data: ids.map((walletId) => ({ groupId: created.id, walletId })),
      });
    }
    return created;
  });
  res.status(201).json({
    group: {
      id: group.id,
      name: group.name,
      walletIds: ids,
      createdAt: group.createdAt,
    },
  });
}

export async function listGroups(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const groups = await prisma.walletGroup.findMany({
    where: { createdBy: userId },
    orderBy: { createdAt: 'desc' },
    include: { members: { select: { walletId: true } } },
  });
  res.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      walletIds: g.members.map((m) => m.walletId),
      createdAt: g.createdAt,
    })),
  });
}
