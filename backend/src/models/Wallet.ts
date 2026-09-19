export type WalletStatus = 'active' | 'quarantined' | 'drained';

export interface IWallet {
  id: string;
  label: string;
  address: string;
  encryptedPrivateKey: string;
  walletGroupId?: string | null;
  chain: 'bsc';
  status: WalletStatus;
  nativeBalance: string;
  dailySpentNotional: number;
  dailyResetAt: Date;
  lastExecutedAt?: Date | null;
  activeBotCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
