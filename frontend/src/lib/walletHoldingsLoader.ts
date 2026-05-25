import { fetchTokenHoldings } from '../api/holdings.api';
import { useWalletStore } from '../store/walletStore';

/** Monotonic guard so overlapping requests don't clobber newer results (StrictMode / rapid refresh). */
let holdingsSeq = 0;

export async function loadHoldingsToStore(walletAddress: string): Promise<void> {
  const seq = ++holdingsSeq;
  const store = useWalletStore.getState();
  store.setHoldingsLoading(true);
  store.setHoldingsError(null);
  try {
    const holdings = await fetchTokenHoldings(walletAddress);
    if (seq !== holdingsSeq) return;
    store.setHoldings(holdings);
  } catch (e: unknown) {
    if (seq !== holdingsSeq) return;
    store.setHoldingsError(e instanceof Error ? e.message : 'Failed to load token holdings');
  } finally {
    if (seq === holdingsSeq) store.setHoldingsLoading(false);
  }
}

/** Bump sequence so any in-flight load is ignored after disconnect / chain change / clear. */
export function invalidateHoldingsRequests(): void {
  holdingsSeq += 1;
}
