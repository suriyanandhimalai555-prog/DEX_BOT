import { useConnect, useAccount } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { AlertCircle, CheckCircle, ExternalLink, Loader2, X } from 'lucide-react';
import { animateModalEnter, animateModalExit } from '../../lib/animations';
import { getLenis } from '../../lib/lenis';

const WALLET_LOGOS: Record<string, string> = {
  metaMaskSDK: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
  trustWallet: 'https://trustwallet.com/assets/images/favicon.png',
  walletConnect: 'https://avatars.githubusercontent.com/u/37784886?s=200&v=4',
  phantom: 'https://phantom.app/img/phantom-logo.png',
};

const WALLET_DISPLAY: Record<
  string,
  {
    name: string;
    description: string;
    logo: string;
    downloadUrl: string;
    badge?: string;
  }
> = {
  metaMaskSDK: {
    name: 'MetaMask',
    logo: WALLET_LOGOS.metaMaskSDK,
    description: 'Connect using the MetaMask browser extension',
    downloadUrl: 'https://metamask.io/download/',
    badge: 'Most popular',
  },
  trustWallet: {
    name: 'Trust Wallet',
    logo: WALLET_LOGOS.trustWallet,
    description: 'Connect via Trust Wallet mobile app or extension',
    downloadUrl: 'https://trustwallet.com/download',
  },
  walletConnect: {
    name: 'WalletConnect',
    logo: WALLET_LOGOS.walletConnect,
    description: 'Scan QR code with any compatible mobile wallet',
    downloadUrl: 'https://walletconnect.com/',
    badge: 'Mobile',
  },
  phantom: {
    name: 'Phantom',
    logo: WALLET_LOGOS.phantom,
    description: 'Connect via Phantom wallet (EVM)',
    downloadUrl: 'https://phantom.app/',
    badge: 'EVM + Solana',
  },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectWalletModal({ isOpen, onClose }: Props): JSX.Element | null {
  const { connect, connectors, isPending, error } = useConnect();
  const { isConnected } = useAccount();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [detectionMap, setDetectionMap] = useState<Record<string, boolean>>({});
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isConnected) {
      setConnectingId(null);
      onClose();
    }
  }, [isConnected, onClose]);

  useEffect(() => {
    if (error) setConnectingId(null);
  }, [error]);

  useEffect(() => {
    if (!isOpen) return;
    const eth = window.ethereum;
    setDetectionMap({
      metaMaskSDK: !!(eth?.isMetaMask && !eth?.isPhantom),
      trustWallet: !!window.trustwallet || !!eth?.isTrust,
      walletConnect: true,
      phantom: !!window.phantom?.ethereum,
    });
  }, [isOpen]);

  useEffect(() => {
    const lenis = getLenis();
    if (isOpen) lenis?.stop();
    else lenis?.start();
    return () => lenis?.start();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !overlayRef.current || !panelRef.current) return;
    animateModalEnter(overlayRef.current, panelRef.current);
    gsap.fromTo(
      '.wallet-option-card',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.08, delay: 0.15 }
    );
  }, [isOpen]);

  function requestClose(): void {
    if (!overlayRef.current || !panelRef.current) {
      onClose();
      return;
    }
    animateModalExit(overlayRef.current, panelRef.current, onClose);
  }

  function handleConnect(connectorId: string): void {
    const connector = connectors.find((c) => c.id === connectorId);
    if (!connector) return;
    setConnectingId(connectorId);
    connect({ connector, chainId: bsc.id });
  }

  if (!isOpen) return null;

  const orderedIds = ['metaMaskSDK', 'trustWallet', 'walletConnect', 'phantom'] as const;

  return (
    <div
      ref={overlayRef}
      data-gsap
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={panelRef}
        data-gsap
        className="relative mx-4 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-modal)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] p-6">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Connect wallet</h2>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Choose your wallet (BSC Mainnet)</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-depth)] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {orderedIds.map((id) => {
            const connector = connectors.find((c) => c.id === id);
            const display = WALLET_DISPLAY[id];
            if (!connector || !display) return null;

            const isInstalled = detectionMap[id] ?? false;
            const isLoading = connectingId === id && isPending;
            const isDisabled = connectingId != null && connectingId !== id;

            return (
              <WalletCard
                key={id}
                name={display.name}
                logo={display.logo}
                description={display.description}
                downloadUrl={display.downloadUrl}
                badge={display.badge}
                isInstalled={isInstalled}
                isLoading={isLoading}
                isDisabled={isDisabled}
                onConnect={() => handleConnect(connector.id)}
                showInstallLink={id !== 'walletConnect'}
              />
            );
          })}
        </div>

        {error && (
          <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] p-3">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-[var(--danger)]" />
            <p className="text-sm text-[var(--danger)]">
              {error.message.includes('rejected')
                ? 'Connection rejected. Approve the request in your wallet.'
                : error.message.includes('Already processing')
                  ? 'A connection request is already pending. Check your wallet.'
                  : 'Connection failed. Unlock your wallet and try again.'}
            </p>
          </div>
        )}

        <div className="px-6 pb-5 pt-1">
          <p className="text-center text-xs text-[var(--text-muted)]">
            Connecting is read-only for viewing balances. Import a private key separately if you want this address
            on the bot backend.
          </p>
        </div>
      </div>
    </div>
  );
}

interface WalletCardProps {
  name: string;
  logo: string;
  description: string;
  downloadUrl: string;
  badge?: string;
  isInstalled: boolean;
  isLoading: boolean;
  isDisabled: boolean;
  onConnect: () => void;
  showInstallLink: boolean;
}

function WalletCard({
  name,
  logo,
  description,
  downloadUrl,
  badge,
  isInstalled,
  isLoading,
  isDisabled,
  onConnect,
  showInstallLink,
}: WalletCardProps): JSX.Element {
  const [logoError, setLogoError] = useState(false);

  return (
    <div
      data-gsap
      className={[
        'wallet-option-card relative flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-all',
        isDisabled
          ? 'cursor-not-allowed border-[var(--border)] opacity-40'
          : 'cursor-pointer border-[var(--border)] hover:border-[var(--info)] hover:bg-[var(--bg-depth)] active:scale-[0.99]',
        isLoading ? 'border-[var(--info)] bg-[var(--info-bg)]' : '',
      ].join(' ')}
      onClick={() => {
        if (!isDisabled && !isLoading) onConnect();
      }}
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-depth)]">
        {logoError ? (
          <span className="text-xl font-bold text-[var(--text-muted)]">{name.charAt(0)}</span>
        ) : (
          <img
            src={logo}
            alt=""
            className="h-8 w-8 object-contain"
            onError={() => setLogoError(true)}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-[var(--text-primary)]">{name}</span>
          {badge && (
            <span className="rounded-full border border-[var(--info)]/40 bg-[var(--info-bg)] px-2 py-0.5 text-xs text-[var(--info)]">
              {badge}
            </span>
          )}
          {isInstalled && (
            <span className="flex items-center gap-1 rounded-full border border-[var(--brand)]/40 bg-[var(--brand-bg)] px-2 py-0.5 text-xs text-[var(--brand-dark)]">
              <CheckCircle size={10} />
              Detected
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-[var(--text-secondary)]">{description}</p>
      </div>

      <div className="flex-shrink-0">
        {isLoading ? (
          <Loader2 size={20} className="animate-spin text-[var(--info)]" />
        ) : showInstallLink && !isInstalled ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-[var(--info)] hover:opacity-80"
          >
            Install <ExternalLink size={12} />
          </a>
        ) : (
          <div className="h-2 w-2 rounded-full bg-[var(--text-muted)]" />
        )}
      </div>
    </div>
  );
}
