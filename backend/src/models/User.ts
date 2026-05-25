import mongoose, { Schema, type Document } from 'mongoose';

export type UserRole = 'admin' | 'trader' | 'observer';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  totpSecret?: string;
  isTotpEnabled: boolean;
  telegramChatId?: string;
  role: UserRole;
  isActive: boolean;
  tradeLimitUSD: number;
  tradeLimitBNB: number;
  tokenVersion: number;
  encryptionKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, default: 'User' },
    totpSecret: { type: String, select: false },
    isTotpEnabled: { type: Boolean, default: false },
    telegramChatId: { type: String },
    role: {
      type: String,
      enum: ['admin', 'trader', 'observer'],
      default: 'trader',
    },
    isActive: { type: Boolean, default: true },
    tradeLimitUSD: { type: Number, default: 1 },
    tradeLimitBNB: { type: Number, default: 0.003 },
    tokenVersion: { type: Number, default: 0 },
    encryptionKey: { type: String, select: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
