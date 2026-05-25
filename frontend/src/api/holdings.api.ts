import { api } from './client';
import type { TokenHolding } from '../store/walletStore';

export type { TokenHolding };

export async function fetchTokenHoldings(walletAddress: string): Promise<TokenHolding[]> {
  const res = await api.get<{ holdings: TokenHolding[] }>(`/holdings/${walletAddress}`);
  return res.data.holdings;
}
