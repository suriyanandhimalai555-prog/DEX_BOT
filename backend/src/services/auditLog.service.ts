import type { Request } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import mongoose from 'mongoose';

export async function logAudit(
  action: string,
  options: {
    userId?: string;
    details?: string;
    ipAddress?: string;
  } = {}
): Promise<void> {
  await AuditLog.create({
    userId: options.userId ? new mongoose.Types.ObjectId(options.userId) : undefined,
    action,
    details: options.details,
    ipAddress: options.ipAddress,
    createdAt: new Date(),
  });
}

export function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.socket.remoteAddress;
}
