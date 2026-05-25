import mongoose, { Schema, type Document } from 'mongoose';

export type TxStatus = 'pending' | 'submitted' | 'confirmed' | 'failed';

export type FailureCode =
  | 'INSUFFICIENT_BALANCE'
  | 'ROUTE_UNAVAILABLE'
  | 'SLIPPAGE_EXCEEDED'
  | 'ALLOWANCE_REQUIRED'
  | 'NONCE_CONFLICT'
  | 'RPC_UNAVAILABLE'
  | 'TOKEN_RESTRICTED'
  | 'GAS_ESTIMATION_FAILED'
  | 'UNKNOWN_REVERT';

export interface ITransaction extends Document {
  botId: mongoose.Types.ObjectId;
  botRunId: mongoose.Types.ObjectId;
  walletId: mongoose.Types.ObjectId;
  walletAddress: string;
  chain: 'bsc';
  dex: 'pancakeswap' | 'uniswap';
  dexVersion: 'v2' | 'v3';
  side: 'buy' | 'sell';
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount?: string;
  txHash?: string;
  status: TxStatus;
  failureCode?: FailureCode;
  failureReason?: string;
  gasSpentBNB?: string;
  quotedPrice?: string;
  executedPrice?: string;
  submittedAt?: Date;
  confirmedAt?: Date;
  wasLimitCapped?: boolean;
  limitCapDetails?: {
    requestedBNB: string;
    cappedToBNB: string;
    limitUSD: number;
    bnbPriceAtTrade: number;
  };
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true, index: true },
    botRunId: { type: Schema.Types.ObjectId, ref: 'BotRun', required: true },
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    walletAddress: { type: String, required: true },
    chain: { type: String, enum: ['bsc'], default: 'bsc' },
    dex: { type: String, enum: ['pancakeswap', 'uniswap'], default: 'pancakeswap' },
    dexVersion: { type: String, enum: ['v2', 'v3'], required: true },
    side: { type: String, enum: ['buy', 'sell'], required: true },
    inputToken: { type: String, required: true },
    outputToken: { type: String, required: true },
    inputAmount: { type: String, required: true },
    outputAmount: { type: String },
    txHash: { type: String, index: true },
    status: {
      type: String,
      enum: ['pending', 'submitted', 'confirmed', 'failed'],
      default: 'pending',
    },
    failureCode: { type: String },
    failureReason: { type: String },
    gasSpentBNB: { type: String },
    quotedPrice: { type: String },
    executedPrice: { type: String },
    submittedAt: { type: Date },
    confirmedAt: { type: Date },
    wasLimitCapped: { type: Boolean, default: false },
    limitCapDetails: {
      requestedBNB: String,
      cappedToBNB: String,
      limitUSD: Number,
      bnbPriceAtTrade: Number,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

TransactionSchema.index({ botId: 1, createdAt: -1 });
TransactionSchema.index({ createdBy: 1, createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
