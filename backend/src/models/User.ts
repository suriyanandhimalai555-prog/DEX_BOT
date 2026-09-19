export type UserRole = 'admin' | 'trader' | 'observer';

export interface IUser {
  id: string;
  email: string;
  passwordHash?: string;
  displayName: string;
  totpSecret?: string | null;
  isTotpEnabled: boolean;
  telegramChatId?: string | null;
  role: UserRole;
  isActive: boolean;
  tradeLimitUSD: number;
  tradeLimitBNB: number;
  tokenVersion: number;
  encryptionKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
