import { useAccount, useDisconnect, useSwitchChain } from 'wagmi';
import { bsc } from 'wagmi/chains';
import {
  invalidateHoldingsRequests,
  loadHoldingsToStore,
} from '../lib/walletHoldingsLoader';

export function useWalletConnectActions(): {
  address: string | undefined;
  chainId: number | undefined;
  isConnected: boolean;
  isWrongNetwork: boolean;
  disconnect: () => void;
  switchToBsc: () => void;
  refreshHoldings: () => Promise<void>;
} {
  const { address, chainId, isConnected } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  function disconnect(): void {
    invalidateHoldingsRequests();
    wagmiDisconnect();
  }

  function switchToBsc(): void {
    switchChain({ chainId: bsc.id });
  }

  async function refreshHoldings(): Promise<void> {
    if (!address || chainId !== bsc.id) return;
    await loadHoldingsToStore(address);
  }

  return {
    address,
    chainId,
    isConnected,
    isWrongNetwork: !!(isConnected && chainId != null && chainId !== bsc.id),
    disconnect,
    switchToBsc,
    refreshHoldings,
  };
}
