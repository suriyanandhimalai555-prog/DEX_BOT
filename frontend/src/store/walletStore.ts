import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TokenHolding {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceRaw: string;
  usdValue?: string;
  logoUrl?: string | null;
  priceUsd?: string;
}

interface WalletStore {
  connectedAddress: string | null;
  chainId: number | null;
  isWrongNetwork: boolean;
  holdings: TokenHolding[];
  holdingsLoading: boolean;
  holdingsError: string | null;
  setConnected: (address: string, chainId: number) => void;
  setDisconnected: () => void;
  setHoldings: (holdings: TokenHolding[]) => void;
  setHoldingsLoading: (v: boolean) => void;
  setHoldingsError: (e: string | null) => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      connectedAddress: null,
      chainId: null,
      isWrongNetwork: false,
      holdings: [],
      holdingsLoading: false,
      holdingsError: null,
      setConnected: (address, chainId) =>
        set({
          connectedAddress: address,
          chainId,
          isWrongNetwork: chainId !== 56,
        }),
      setDisconnected: () =>
        set({
          connectedAddress: null,
          chainId: null,
          holdings: [],
          holdingsLoading: false,
          holdingsError: null,
          isWrongNetwork: false,
        }),
      setHoldings: (holdings) => set({ holdings }),
      setHoldingsLoading: (holdingsLoading) => set({ holdingsLoading }),
      setHoldingsError: (holdingsError) => set({ holdingsError }),
    }),
    {
      name: 'wallet-connection',
      partialize: (s) => ({
        connectedAddress: s.connectedAddress,
        chainId: s.chainId,
        isWrongNetwork: s.isWrongNetwork,
      }),
    }
  )
);
