import type { Request } from 'express';
import { prisma } from '../config/prisma.js';

export async function logAudit(
  action: string,
  options: {
    userId?: string;
    details?: string;
    ipAddress?: string;
  } = {}
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: options.userId,
      action,
      details: options.details,
      ipAddress: options.ipAddress,
      createdAt: new Date(),
    },
  });
}

export function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.socket.remoteAddress;
}
