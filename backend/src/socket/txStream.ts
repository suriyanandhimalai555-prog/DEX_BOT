import type { Server as SocketIOServer } from 'socket.io';
import type { ITransaction } from '../models/Transaction.js';
import type { FailureCode } from '../models/Transaction.js';
import type { BotStatus } from '../models/Bot.js';

let io: SocketIOServer | null = null;

export function attachSocketIo(serverIo: SocketIOServer): void {
  io = serverIo;
}

function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitTxSubmitted(userId: string, transaction: ITransaction): void {
  emitToUser(userId, 'tx:submitted', { transaction });
}

export function emitTxConfirmed(userId: string, transaction: ITransaction): void {
  emitToUser(userId, 'tx:confirmed', { transaction });
}

export function emitTxFailed(
  userId: string,
  transaction: ITransaction,
  failureCode: FailureCode
): void {
  emitToUser(userId, 'tx:failed', { transaction, failureCode });
}

export type BotLogLevel = 'info' | 'warn' | 'error' | 'success';

export type BotLogPayload = {
  botId: string;
  level: BotLogLevel;
  message: string;
  details?: Record<string, unknown>;
};

export function emitBotLog(userId: string, payload: BotLogPayload): void {
  emitToUser(userId, 'bot:log', payload);
}

export function emitBotStatus(userId: string, botId: string, status: BotStatus): void {
  emitToUser(userId, 'bot:status', { botId, status });
}

export function emitBotError(userId: string, botId: string, message: string): void {
  emitToUser(userId, 'bot:error', { botId, message });
}
