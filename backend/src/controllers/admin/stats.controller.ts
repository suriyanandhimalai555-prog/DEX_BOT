import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { bnbPriceService } from '../../services/bnbPrice.service.js';

export async function platformStats(_req: Request, res: Response): Promise<void> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const [
    totalTraders,
    activeTraders,
    totalBots,
    activeBots,
    pendingRequests,
    txs,
  ] = await Promise.all([
    prisma.user.count({ where: { role: { in: ['trader', 'observer'] } } }),
    prisma.user.count({
      where: { role: { in: ['trader', 'observer'] }, isActive: true },
    }),
    prisma.bot.count(),
    prisma.bot.count({ where: { status: 'active' } }),
    prisma.limitRequest.count({ where: { status: 'pending' } }),
    prisma.transaction.findMany({
      where: { status: 'confirmed', createdAt: { gte: start } },
      select: { inputAmount: true },
    }),
  ]);

  let volumeWei = 0n;
  for (const t of txs) {
    try {
      volumeWei += BigInt(t.inputAmount);
    } catch {
      /* skip */
    }
  }
  const volumeBNB = Number(volumeWei) / 1e18;
  const bnbPrice = bnbPriceService.getCurrentPrice();

  res.json({
    totalTraders,
    activeTraders,
    totalBots,
    activeBots,
    pendingRequests,
    totalVolumeBNB: volumeBNB.toFixed(6),
    totalVolumeUSD: (volumeBNB * bnbPrice).toFixed(2),
    totalPnlBNB: '0',
    bnbPrice: bnbPriceService.getStatus(),
  });
}
