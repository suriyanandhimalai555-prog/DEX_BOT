import { useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { ChevronDown, Copy, LayoutList, LogOut, Wallet } from 'lucide-react';
import { ConnectWalletModal } from '../wallets/ConnectWalletModal';
import { TokenHoldingsModal } from '../wallets/TokenHoldingsModal';
import { useWalletConnectActions } from '../../hooks/useWalletConnectActions';

const WALLET_LOGOS: Record<string, string> = {
  metaMaskSDK: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
  trustWallet: 'https://trustwallet.com/assets/images/favicon.png',
  walletConnect: 'https://avatars.githubusercontent.com/u/37784886?s=200&v=4',
  phantom: 'https://phantom.app/img/phantom-logo.png',
};

export function ConnectWalletButton(): JSX.Element {
  const { address, isConnected, connector, chainId } = useAccount();
  const { switchToBsc, disconnect } = useWalletConnectActions();

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showHoldings, setShowHoldings] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isWrongNetwork = !!(isConnected && chainId !== 56);

  useEffect(() => {
    if (!showDropdown) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showDropdown]);

  function truncate(addr: string): string {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }

  function copyAddress(): void {
    if (!address) return;
    void navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!isConnected) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowConnectModal(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-depth)]"
        >
          <Wallet size={16} className="text-[var(--text-muted)]" />
          Connect Wallet
        </button>
        <ConnectWalletModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} />
      </>
    );
  }

  if (isWrongNetwork) {
    return (
      <button
        type="button"
        onClick={() => switchToBsc()}
        className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-[var(--warning-bg)] px-4 py-2 text-sm font-medium text-[var(--warning)] transition-colors hover:opacity-90"
      >
        ⚠ Switch to BSC
      </button>
    );
  }

  const cid = connector?.id ?? '';
  const logoUrl = WALLET_LOGOS[cid];

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setShowDropdown((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-depth)]"
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-5 w-5 rounded object-contain" />
          ) : (
            <Wallet size={16} className="text-[var(--text-muted)]" />
          )}
          <span className="font-mono">{address ? truncate(address) : '—'}</span>
          <ChevronDown size={14} className="text-[var(--text-muted)]" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 z-[80] mt-2 w-52 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-modal)]">
            <button
              type="button"
              onClick={() => {
                copyAddress();
                setShowDropdown(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-depth)] hover:text-[var(--text-primary)]"
            >
              <Copy size={14} />
              {copied ? 'Copied!' : 'Copy address'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowHoldings(true);
                setShowDropdown(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-depth)] hover:text-[var(--text-primary)]"
            >
              <LayoutList size={14} />
              View Holdings
            </button>
            <div className="border-t border-[var(--border)]" />
            <button
              type="button"
              onClick={() => {
                disconnect();
                setShowDropdown(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--danger)] transition-colors hover:bg-[var(--danger-bg)]"
            >
              <LogOut size={14} />
              Disconnect
            </button>
          </div>
        )}
      </div>

      <TokenHoldingsModal isOpen={showHoldings} onClose={() => setShowHoldings(false)} />
    </>
  );
}
