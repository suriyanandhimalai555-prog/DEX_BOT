export type LimitRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ILimitRequest {
  id: string;
  userId: string;
  requestedUSD: number;
  currentUSD: number;
  reason: string;
  status: LimitRequestStatus;
  adminNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
