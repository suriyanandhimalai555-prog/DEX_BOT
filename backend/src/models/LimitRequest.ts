import mongoose, { Schema, type Document } from 'mongoose';

export type LimitRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ILimitRequest extends Document {
  userId: mongoose.Types.ObjectId;
  requestedUSD: number;
  currentUSD: number;
  reason: string;
  status: LimitRequestStatus;
  adminNote?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LimitRequestSchema = new Schema<ILimitRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedUSD: { type: Number, required: true },
    currentUSD: { type: Number, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNote: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

LimitRequestSchema.index({ userId: 1, status: 1 });

export const LimitRequest = mongoose.model<ILimitRequest>('LimitRequest', LimitRequestSchema);
