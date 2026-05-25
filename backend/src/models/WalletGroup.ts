import mongoose, { Schema, type Document } from 'mongoose';

export interface IWalletGroup extends Document {
  name: string;
  walletIds: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WalletGroupSchema = new Schema<IWalletGroup>(
  {
    name: { type: String, required: true },
    walletIds: [{ type: Schema.Types.ObjectId, ref: 'Wallet' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const WalletGroup = mongoose.model<IWalletGroup>('WalletGroup', WalletGroupSchema);
