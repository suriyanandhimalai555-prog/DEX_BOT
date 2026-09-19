import type { Prisma } from '@prisma/client';
import type { IBot, GasPolicy, RiskPolicy } from '../models/Bot.js';
import type { ITransaction, LimitCapDetails } from '../models/Transaction.js';
import type { IUser } from '../models/User.js';
import type { IWallet } from '../models/Wallet.js';

export const userPublicSelect = {
  id: true,
  email: true,
  displayName: true,
  isTotpEnabled: true,
  telegramChatId: true,
  role: true,
  isActive: true,
  tradeLimitUSD: true,
  tradeLimitBNB: true,
  tokenVersion: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type UserPublicRow = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;

export function mapUser(
  row: UserPublicRow & {
    passwordHash?: string;
    totpSecret?: string | null;
    encryptionKey?: string | null;
  }
): IUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    totpSecret: row.totpSecret,
    isTotpEnabled: row.isTotpEnabled,
    telegramChatId: row.telegramChatId,
    role: row.role,
    isActive: row.isActive,
    tradeLimitUSD: row.tradeLimitUSD,
    tradeLimitBNB: row.tradeLimitBNB,
    tokenVersion: row.tokenVersion,
    encryptionKey: row.encryptionKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapWallet(
  row: Prisma.WalletGetPayload<object>,
  includeSecret = false
): IWallet {
  return {
    id: row.id,
    label: row.label,
    address: row.address,
    encryptedPrivateKey: includeSecret ? row.encryptedPrivateKey : '',
    walletGroupId: row.walletGroupId,
    chain: row.chain,
    status: row.status,
    nativeBalance: row.nativeBalance,
    dailySpentNotional: row.dailySpentNotional,
    dailyResetAt: row.dailyResetAt,
    lastExecutedAt: row.lastExecutedAt,
    activeBotCount: row.activeBotCount,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapBot(row: Prisma.BotGetPayload<object>): IBot {
  return {
    id: row.id,
    name: row.name,
    strategyType: row.strategyType,
    chain: row.chain,
    dex: row.dex,
    dexVersion: row.dexVersion,
    baseToken: row.baseToken,
    quoteToken: row.quoteToken,
    walletGroupId: row.walletGroupId,
    buyEnabled: row.buyEnabled,
    sellEnabled: row.sellEnabled,
    amountMin: row.amountMin,
    amountMax: row.amountMax,
    intervalSeconds: row.intervalSeconds,
    slippageBps: row.slippageBps,
    gasPolicy: row.gasPolicy as unknown as GasPolicy,
    riskPolicy: row.riskPolicy as unknown as RiskPolicy,
    status: row.status,
    lastRunAt: row.lastRunAt,
    consecutiveFailures: row.consecutiveFailures,
    cooldownUntil: row.cooldownUntil,
    dailyNotionalUSD: row.dailyNotionalUSD,
    dailyNotionalResetAt: row.dailyNotionalResetAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapTransaction(row: Prisma.TransactionGetPayload<object>): ITransaction {
  return {
    id: row.id,
    botId: row.botId,
    botRunId: row.botRunId,
    walletId: row.walletId,
    walletAddress: row.walletAddress,
    chain: row.chain,
    dex: row.dex,
    dexVersion: row.dexVersion,
    side: row.side,
    inputToken: row.inputToken,
    outputToken: row.outputToken,
    inputAmount: row.inputAmount,
    outputAmount: row.outputAmount,
    txHash: row.txHash,
    status: row.status,
    failureCode: row.failureCode,
    failureReason: row.failureReason,
    gasSpentBNB: row.gasSpentBNB,
    quotedPrice: row.quotedPrice,
    executedPrice: row.executedPrice,
    submittedAt: row.submittedAt,
    confirmedAt: row.confirmedAt,
    wasLimitCapped: row.wasLimitCapped,
    limitCapDetails: (row.limitCapDetails as unknown as LimitCapDetails | null) ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
