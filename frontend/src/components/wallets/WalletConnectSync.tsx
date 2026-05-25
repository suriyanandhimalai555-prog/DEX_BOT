import { useWalletConnectionSync } from '../../hooks/useWalletConnectionSync';

export function WalletConnectSync(): null {
  useWalletConnectionSync();
  return null;
}
