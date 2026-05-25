export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'trader' | 'observer';
  isTotpEnabled: boolean;
  isActive: boolean;
  tradeLimitUSD: number;
  tradeLimitBNB: number;
  telegramChatId?: string;
  createdAt?: string;
}

export interface LimitRequest {
  id: string;
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  requestedUSD: number;
  currentUSD: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  tradeLimitUSD: number;
  tradeLimitBNB: number;
  pendingRequestCount: number;
  activeBotCount: number;
  createdAt: string;
}

export interface PlatformStats {
  totalTraders: number;
  activeTraders: number;
  totalBots: number;
  activeBots: number;
  pendingRequests: number;
  totalVolumeBNB: string;
  totalVolumeUSD: string;
  totalPnlBNB: string;
  bnbPrice?: BnbPriceStatus;
}

export interface BnbPriceStatus {
  currentPriceUSD: number;
  lastFetchAt: string | null;
  oneDollarInBNB: string;
  updatedAt?: string | null;
}

export type User = AuthUser;

export interface BotSummary {
  id: string;
  name: string;
  strategyType: string;
  dex?: string;
  dexVersion: string;
  dexLabel?: string;
  routerAddress?: string;
  status: string;
  lastRunAt?: string;
  consecutiveFailures: number;
}

export interface BotDetailRecord extends BotSummary {
  baseToken: string;
  quoteToken: string;
  walletGroupId: string;
  buyEnabled: boolean;
  sellEnabled: boolean;
  amountMin: string;
  amountMax: string;
  intervalSeconds: number;
  slippageBps: number;
  gasPolicy: { mode: string; maxGweiOverride?: number };
  riskPolicy: {
    cooldownOnFailureSeconds: number;
    maxDailyNotionalUSD: number;
    maxConcurrentWallets?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface BotRunRow {
  id: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  successCount?: number;
  failureCount?: number;
}

export interface WalletRow {
  id: string;
  label: string;
  address: string;
  status: string;
  nativeBalance: string;
  dailySpentNotional: number;
  activeBotCount: number;
  lastExecutedAt?: string;
}

export interface TxRow {
  id: string;
  walletAddress: string;
  side: string;
  inputAmount: string;
  outputAmount?: string;
  status: string;
  txHash?: string;
  quotedPrice?: string;
  createdAt: string;
}
