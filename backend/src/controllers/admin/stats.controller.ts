import type { Request, Response } from 'express';
import { User } from '../../models/User.js';
import { Bot } from '../../models/Bot.js';
import { LimitRequest } from '../../models/LimitRequest.js';
import { Transaction } from '../../models/Transaction.js';
import { bnbPriceService } from '../../services/bnbPrice.service.js';

export async function platformStats(_req: Request, res: Response): Promise<void> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const totalTraders = await User.countDocuments({ role: { $in: ['trader', 'observer'] } });
  const activeTraders = await User.countDocuments({
    role: { $in: ['trader', 'observer'] },
    isActive: true,
  });
  const totalBots = await Bot.countDocuments();
  const activeBots = await Bot.countDocuments({ status: 'active' });
  const pendingRequests = await LimitRequest.countDocuments({ status: 'pending' });

  const txs = await Transaction.find({
    status: 'confirmed',
    createdAt: { $gte: start },
  }).select('inputAmount').lean();

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
