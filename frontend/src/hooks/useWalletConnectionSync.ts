import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { bsc } from 'wagmi/chains';
import {
  invalidateHoldingsRequests,
  loadHoldingsToStore,
} from '../lib/walletHoldingsLoader';
import { useWalletStore } from '../store/walletStore';

/** Single place: wagmi session → Zustand + holdings fetch BSC-only. Mount once via PanelShell (trader/admin layouts). */
export function useWalletConnectionSync(): void {
  const { address, chainId, isConnected } = useAccount();

  const setConnected = useWalletStore((s) => s.setConnected);
  const setDisconnected = useWalletStore((s) => s.setDisconnected);
  const setHoldings = useWalletStore((s) => s.setHoldings);
  const setHoldingsLoading = useWalletStore((s) => s.setHoldingsLoading);
  const setHoldingsError = useWalletStore((s) => s.setHoldingsError);

  useEffect(() => {
    if (!isConnected || !address || chainId == null) {
      invalidateHoldingsRequests();
      setDisconnected();
      return;
    }
    setConnected(address, chainId);
  }, [isConnected, address, chainId, setConnected, setDisconnected]);

  useEffect(() => {
    if (!isConnected || !address || chainId !== bsc.id) {
      invalidateHoldingsRequests();
      setHoldings([]);
      setHoldingsError(null);
      setHoldingsLoading(false);
      return;
    }

    void loadHoldingsToStore(address);
  }, [isConnected, address, chainId, setHoldings, setHoldingsError, setHoldingsLoading]);
}
