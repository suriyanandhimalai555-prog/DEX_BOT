import { createConfig, http } from 'wagmi';
import type { EIP1193Provider } from 'viem';
import { bsc } from 'wagmi/chains';
import { injected, metaMask, walletConnect } from '@wagmi/connectors';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim() ?? '';

const trustWallet = injected({
  target: {
    id: 'trustWallet',
    name: 'Trust Wallet',
    provider(win) {
      if (!win) return undefined;
      const w = win as Window;
      const provider =
        w.trustwallet ??
        (w.ethereum?.isTrust ? w.ethereum : undefined);
      return provider as EIP1193Provider | undefined;
    },
  },
});

const phantomEvm = injected({
  target: {
    id: 'phantom',
    name: 'Phantom',
    provider(win) {
      if (!win) return undefined;
      return (win as Window).phantom?.ethereum as EIP1193Provider | undefined;
    },
  },
});

const connectors = [
  metaMask({
    dappMetadata: {
      name: 'DEX Bot Platform',
    },
  }),
  trustWallet,
  ...(projectId
    ? [
        walletConnect({
          projectId,
          metadata: {
            name: 'DEX Bot Platform',
            description: 'DEX market-making automation',
            url:
              typeof window !== 'undefined'
                ? window.location.origin
                : 'http://localhost:5173',
            icons: [],
          },
          showQrModal: true,
        }),
      ]
    : []),
  phantomEvm,
];

const rpcUrl =
  import.meta.env.VITE_ALCHEMY_BSC_URL?.trim() ||
  'https://bsc-dataseed.binance.org';

export const wagmiConfig = createConfig({
  chains: [bsc],
  connectors,
  transports: {
    [bsc.id]: http(rpcUrl),
  },
});
