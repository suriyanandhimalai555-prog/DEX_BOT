import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';

export async function listAllBots(_req: Request, res: Response): Promise<void> {
  const bots = await prisma.bot.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      creator: { select: { email: true, displayName: true } },
    },
  });
  const enriched = bots.map((b) => ({
    id: b.id,
    name: b.name,
    strategyType: b.strategyType,
    status: b.status,
    dex: b.dex,
    dexVersion: b.dexVersion,
    createdBy: b.createdBy,
    ownerEmail: b.creator.email,
    ownerName: b.creator.displayName,
    lastRunAt: b.lastRunAt,
    createdAt: b.createdAt,
  }));
  res.json({ bots: enriched });
}
