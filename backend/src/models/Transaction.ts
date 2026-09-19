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

export interface LimitCapDetails {
  requestedBNB: string;
  cappedToBNB: string;
  limitUSD: number;
  bnbPriceAtTrade: number;
}

export interface ITransaction {
  id: string;
  botId: string;
  botRunId: string;
  walletId: string;
  walletAddress: string;
  chain: 'bsc';
  dex: 'pancakeswap' | 'uniswap';
  dexVersion: 'v2' | 'v3';
  side: 'buy' | 'sell';
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount?: string | null;
  txHash?: string | null;
  status: TxStatus;
  failureCode?: FailureCode | null;
  failureReason?: string | null;
  gasSpentBNB?: string | null;
  quotedPrice?: string | null;
  executedPrice?: string | null;
  submittedAt?: Date | null;
  confirmedAt?: Date | null;
  wasLimitCapped?: boolean;
  limitCapDetails?: LimitCapDetails | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
