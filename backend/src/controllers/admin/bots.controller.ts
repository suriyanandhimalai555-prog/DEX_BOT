import type { Request, Response } from 'express';
import { Bot } from '../../models/Bot.js';
import { User } from '../../models/User.js';

export async function listAllBots(_req: Request, res: Response): Promise<void> {
  const bots = await Bot.find().sort({ updatedAt: -1 }).lean();
  const enriched = await Promise.all(
    bots.map(async (b) => {
      const owner = await User.findById(b.createdBy).select('email displayName');
      return {
        id: b._id.toString(),
        name: b.name,
        strategyType: b.strategyType,
        status: b.status,
        dex: b.dex,
        dexVersion: b.dexVersion,
        createdBy: b.createdBy.toString(),
        ownerEmail: owner?.email,
        ownerName: owner?.displayName,
        lastRunAt: b.lastRunAt,
        createdAt: b.createdAt,
      };
    })
  );
  res.json({ bots: enriched });
}
