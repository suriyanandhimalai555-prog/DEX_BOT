import { api } from './client';
import type { LimitRequest } from './types';

export async function submitLimitRequest(
  requestedUSD: number,
  reason: string
): Promise<{ request: LimitRequest }> {
  const res = await api.post('/trader/limit-requests', { requestedUSD, reason });
  return res.data;
}

export async function getMyLimitRequests(): Promise<{ requests: LimitRequest[] }> {
  const res = await api.get('/trader/limit-requests');
  return res.data;
}

export async function cancelLimitRequest(id: string): Promise<void> {
  await api.delete(`/trader/limit-requests/${id}`);
}
