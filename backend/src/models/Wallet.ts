import mongoose, { Schema, type Document } from 'mongoose';

export interface IWallet extends Document {
  label: string;
  address: string;
  encryptedPrivateKey: string;
  walletGroupId?: mongoose.Types.ObjectId;
  chain: 'bsc';
  status: 'active' | 'quarantined' | 'drained';
  nativeBalance: string;
  dailySpentNotional: number;
  dailyResetAt: Date;
  lastExecutedAt?: Date;
  activeBotCount: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    label: { type: String, required: true },
    address: { type: String, required: true, index: true },
    encryptedPrivateKey: { type: String, required: true, select: false },
    walletGroupId: { type: Schema.Types.ObjectId, ref: 'WalletGroup' },
    chain: { type: String, enum: ['bsc'], default: 'bsc' },
    status: {
      type: String,
      enum: ['active', 'quarantined', 'drained'],
      default: 'active',
    },
    nativeBalance: { type: String, default: '0' },
    dailySpentNotional: { type: Number, default: 0 },
    dailyResetAt: { type: Date, default: () => new Date() },
    lastExecutedAt: { type: Date },
    activeBotCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

WalletSchema.index({ createdBy: 1, address: 1 });

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
