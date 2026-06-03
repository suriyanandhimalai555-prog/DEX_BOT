import { useEffect, useMemo, useRef, useState } from 'react';
import type { TokenHolding } from '../../store/walletStore';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useWalletStore } from '../../store/walletStore';
import { truncateAddress, addressHue } from '../../lib/utils';
import { loadHoldingsToStore } from '../../lib/walletHoldingsLoader';
import { ImportWalletDialog } from './ImportWalletDialog';
import { animateListEnter, animateModalEnter, animateModalExit } from '../../lib/animations';
import { getLenis } from '../../lib/lenis';

function HoldingAvatar({ t }: { t: TokenHolding }): JSX.Element {
  const [imgOk, setImgOk] = useState(Boolean(t.logoUrl));
  const hue = t.address === 'NATIVE' ? 160 : addressHue(t.address);
  const letter = (t.symbol || '?').slice(0, 1).toUpperCase();

  if (imgOk && t.logoUrl) {
    return (
      <img
        src={t.logoUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full bg-[var(--bg-depth)] object-cover"
        onError={() => setImgOk(false)}
      />
    );
  }

  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: `hsl(${hue} 50% 36%)` }}
    >
      {letter}
    </div>
  );
}

function RowSkeleton(): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-md bg-[var(--bg-depth)] px-3 py-2">
      <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-1">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-2 w-16 rounded" />
      </div>
      <div className="skeleton h-3 w-20 rounded" />
    </div>
  );
}

export function TokenHoldingsModal({
  isOpen = true,
  onClose,
}: {
  isOpen?: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const connectedAddress = useWalletStore((s) => s.connectedAddress);
  const holdings = useWalletStore((s) => s.holdings);
  const loading = useWalletStore((s) => s.holdingsLoading);
  const error = useWalletStore((s) => s.holdingsError);
  const [q, setQ] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return holdings;
    return holdings.filter(
      (t) =>
        t.symbol.toLowerCase().includes(s) ||
        t.name.toLowerCase().includes(s) ||
        (t.address !== 'NATIVE' && t.address.toLowerCase().includes(s))
    );
  }, [holdings, q]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (a.address === 'NATIVE') return -1;
      if (b.address === 'NATIVE') return 1;
      return 0;
    });
    return copy;
  }, [filtered]);

  const suggestedLabel = connectedAddress
    ? `Browser ${truncateAddress(connectedAddress, 4, 2)}`
    : 'Browser wallet';

  useEffect(() => {
    const lenis = getLenis();
    if (isOpen) lenis?.stop();
    else lenis?.start();
    return () => lenis?.start();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !overlayRef.current || !panelRef.current) return;
    animateModalEnter(overlayRef.current, panelRef.current);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || loading || sorted.length === 0) return;

    const frame = requestAnimationFrame(() => {
      const rows = listRef.current?.querySelectorAll('.token-holding-row');
      if (!rows?.length) return;
      animateListEnter(rows);
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen, loading, sorted]);

  function requestClose(): void {
    if (!overlayRef.current || !panelRef.current) {
      onClose();
      return;
    }
    animateModalExit(overlayRef.current, panelRef.current, onClose);
  }

  if (!isOpen) return null;

  return (
    <>
      <div ref={overlayRef} data-gsap className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
        <Card ref={panelRef} data-gsap className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 p-5">
          <div className="flex flex-shrink-0 items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-[var(--text-primary)]">Token holdings</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                {connectedAddress && (
                  <span className="font-mono text-[var(--text-secondary)]">{truncateAddress(connectedAddress)}</span>
                )}
                <span className="rounded bg-[var(--brand-bg)] px-1.5 py-0.5 text-[var(--brand-dark)]">BSC</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={!connectedAddress || loading}
                onClick={() => connectedAddress && void loadHoldingsToStore(connectedAddress)}
              >
                Refresh
              </Button>
              <Button type="button" variant="ghost" className="shrink-0 text-[var(--text-secondary)]" onClick={requestClose}>
                ✕
              </Button>
            </div>
          </div>

          <Input placeholder="Search name, symbol, or address…" value={q} onChange={(e) => setQ(e.target.value)} />

          <div
            ref={listRef}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
            data-lenis-prevent-wheel
          >
            {loading && (
              <div className="space-y-2">
                <RowSkeleton />
                <RowSkeleton />
                <RowSkeleton />
                <RowSkeleton />
                <RowSkeleton />
              </div>
            )}

            {!loading && error && (
              <div className="rounded-md border border-[var(--danger)]/30 bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger)]">
                {error}
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => connectedAddress && void loadHoldingsToStore(connectedAddress)}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {!loading && !error && sorted.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">No tokens found on BSC for this wallet.</p>
            )}

            {!loading &&
              !error &&
              sorted.map((t) => (
                <div
                  key={t.address}
                  className="token-holding-row table-row grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5"
                >
                  <HoldingAvatar t={t} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--text-primary)]">{t.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{t.symbol}</div>
                  </div>
                  <div className="text-right text-sm leading-tight">
                    <div className="font-mono text-[var(--text-primary)]">{t.balance}</div>
                    {t.usdValue != null && <div className="text-xs text-[var(--brand)]">${t.usdValue}</div>}
                  </div>
                </div>
              ))}
          </div>

          <div className="flex-shrink-0 space-y-2 border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--text-secondary)]">
              Want to use this wallet for bots? MetaMask and Trust Wallet do not expose your private key to apps.
              Export your private key from your wallet settings, then import it below to add it to the bot system.
            </p>
            <Button type="button" className="w-full" onClick={() => setImportOpen(true)}>
              Import wallet private key
            </Button>
          </div>
        </Card>
      </div>

      <ImportWalletDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        suggestedLabel={suggestedLabel}
        footerDisclaimer="Only import a key you understand is stored encrypted on the server. Never share your key."
      />
    </>
  );
}
