import mongoose, { Schema, type Document } from 'mongoose';

export type BotRunStatus = 'running' | 'completed' | 'failed';

export interface IBotRun extends Document {
  botId: mongoose.Types.ObjectId;
  triggeredAt: Date;
  startedAt: Date;
  endedAt?: Date;
  status: BotRunStatus;
  intentCount: number;
  successCount: number;
  failureCount: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BotRunSchema = new Schema<IBotRun>(
  {
    botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true, index: true },
    triggeredAt: { type: Date, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      default: 'running',
    },
    intentCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

BotRunSchema.index({ botId: 1, startedAt: -1 });

export const BotRun = mongoose.model<IBotRun>('BotRun', BotRunSchema);
