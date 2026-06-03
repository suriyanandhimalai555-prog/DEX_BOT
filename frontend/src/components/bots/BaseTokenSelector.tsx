import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, ChevronDown, Wallet, AlertCircle } from 'lucide-react';
import gsap from 'gsap';
import { useWalletStore } from '../../store/walletStore';
import type { TokenHolding } from '../../store/walletStore';
import { cn } from '../../lib/utils';
import { TokenLogo } from '../ui/TokenLogo';
import { addCustomToken, getCustomTokens } from '../../lib/customTokens';
import { isAddressSearch, lookupTokenByAddress, normalizeAddress } from '../../lib/tokenLookup';

interface BaseTokenSelectorProps {
  value: string;
  onChange: (address: string, symbol: string, name: string, decimals: number) => void;
  error?: string;
}

function truncateAddr(addr: string, head = 8, tail = 6): string {
  if (!addr.startsWith('0x') || addr.length < head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

function isErc20Holding(t: TokenHolding): boolean {
  return t.address.startsWith('0x') && t.address.length === 42;
}

function mergeTokenLists(primary: TokenHolding[], extra: TokenHolding[]): TokenHolding[] {
  const byAddr = new Map<string, TokenHolding>();
  for (const t of [...primary, ...extra]) {
    if (!isErc20Holding(t)) continue;
    byAddr.set(normalizeAddress(t.address), t);
  }
  return Array.from(byAddr.values());
}

export function BaseTokenSelector({ value, onChange, error }: BaseTokenSelectorProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customTokens, setCustomTokens] = useState<TokenHolding[]>(() => getCustomTokens());
  const [lookupResult, setLookupResult] = useState<TokenHolding | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const connectedAddress = useWalletStore((s) => s.connectedAddress);
  const holdings = useWalletStore((s) => s.holdings);
  const holdingsLoading = useWalletStore((s) => s.holdingsLoading);

  const erc20Holdings = useMemo(
    () => mergeTokenLists(holdings.filter(isErc20Holding), customTokens),
    [holdings, customTokens]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return erc20Holdings;
    return erc20Holdings.filter((token) => {
      if (token.symbol?.toLowerCase().includes(q)) return true;
      if (token.name?.toLowerCase().includes(q)) return true;
      if (normalizeAddress(token.address).includes(normalizeAddress(q))) return true;
      return false;
    });
  }, [erc20Holdings, search]);

  const selectedToken = useMemo(
    () => erc20Holdings.find((t) => normalizeAddress(t.address) === normalizeAddress(value)),
    [erc20Holdings, value]
  );

  useEffect(() => {
    if (isOpen) setCustomTokens(getCustomTokens());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    gsap.fromTo(
      panelRef.current,
      { opacity: 0, y: -8, scaleY: 0.95 },
      { opacity: 1, y: 0, scaleY: 1, duration: 0.22, ease: 'power2.out', transformOrigin: 'top' }
    );
    const t = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    function handler(e: MouseEvent): void {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setLookupResult(null);
    setLookupError(null);

    if (!isAddressSearch(search)) return;
    if (!connectedAddress) return;

    const existingMatch = erc20Holdings.find(
      (t) => normalizeAddress(t.address) === normalizeAddress(search)
    );
    if (existingMatch) return;

    const timer = window.setTimeout(() => {
      void (async () => {
        setIsLooking(true);
        try {
          const result = await lookupTokenByAddress(search, connectedAddress);
          if (result) {
            setLookupResult(result);
            setLookupError(null);
          } else {
            setLookupResult(null);
            setLookupError('Token not found or not a valid ERC20 contract');
          }
        } catch {
          setLookupResult(null);
          setLookupError('Failed to fetch token info');
        } finally {
          setIsLooking(false);
        }
      })();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [search, erc20Holdings, connectedAddress]);

  function selectToken(token: TokenHolding): void {
    addCustomToken(token);
    setCustomTokens(getCustomTokens());
    onChange(token.address, token.symbol, token.name, token.decimals);
    setIsOpen(false);
    setSearch('');
    setLookupResult(null);
    setLookupError(null);
  }

  if (!connectedAddress) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-[var(--warning)]/35 bg-[var(--warning-bg)] px-4 py-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">No wallet connected</p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Connect your wallet first to pick a token from your holdings.
          </p>
        </div>
      </div>
    );
  }

  const addressSearch = isAddressSearch(search);
  const showEmptyList = !holdingsLoading && filtered.length === 0;

  return (
    <div ref={rootRef} data-token-selector className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-lg border bg-[var(--bg-surface)] px-3.5 py-3 text-left transition-all duration-150',
          error
            ? 'border-[var(--danger)] focus:ring-2 focus:ring-[var(--danger)]/25'
            : isOpen
              ? 'border-[var(--brand)] ring-2 ring-[var(--brand)]/20'
              : 'border-[var(--border)] hover:border-[var(--text-muted)]'
        )}
      >
        {selectedToken ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <TokenLogo token={selectedToken} size="sm" />
            <div className="min-w-0">
              <span className="text-sm font-medium text-[var(--text-primary)]">{selectedToken.symbol}</span>
              <span className="ml-2 text-xs text-[var(--text-muted)]">{selectedToken.name}</span>
              <p className="truncate font-mono text-xs text-[var(--text-secondary)]">
                {truncateAddr(selectedToken.address)}
              </p>
            </div>
          </div>
        ) : value.startsWith('0x') && value.length === 42 ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <TokenLogo token={{ symbol: '?', address: value }} size="sm" />
            <div className="min-w-0">
              <span className="text-sm font-medium text-[var(--text-primary)]">Selected</span>
              <p className="truncate font-mono text-xs text-[var(--text-secondary)]">{truncateAddr(value)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Wallet className="h-4 w-4" />
            <span className="text-sm">Select a token from your wallet</span>
          </div>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {error ? <p className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}

      {isOpen && (
        <div
          ref={panelRef}
          className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-modal)]"
          style={{ maxHeight: 320 }}
        >
          <div className="border-b border-[var(--border)] p-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-depth)] px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, symbol, or paste token address…"
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 248 }} data-lenis-prevent-wheel>
            {holdingsLoading ? (
              <>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="skeleton h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3.5 w-20 rounded" />
                      <div className="skeleton h-2.5 w-32 rounded" />
                    </div>
                    <div className="skeleton h-3.5 w-16 rounded" />
                  </div>
                ))}
              </>
            ) : showEmptyList ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                {addressSearch && isLooking ? (
                  <div className="flex items-center gap-2 text-[var(--brand)]">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Looking up token on-chain…</span>
                  </div>
                ) : addressSearch && lookupResult && !isLooking ? (
                  <button
                    type="button"
                    onClick={() => selectToken(lookupResult)}
                    className="w-full rounded-lg border border-[var(--brand)]/30 bg-[var(--brand-bg)]/40 p-3 text-left transition-colors hover:bg-[var(--brand-bg)]"
                  >
                    <div className="flex items-center gap-3">
                      <TokenLogo token={lookupResult} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-[var(--text-primary)]">
                            {lookupResult.symbol}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">{lookupResult.name}</span>
                        </div>
                        <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
                          {lookupResult.address}
                        </p>
                        <p className="mt-1 text-xs text-[var(--brand)]">Found on-chain — click to select</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{lookupResult.balance}</p>
                        <p className="text-xs text-[var(--text-muted)]">{lookupResult.symbol}</p>
                      </div>
                    </div>
                  </button>
                ) : addressSearch && lookupError && !isLooking ? (
                  <>
                    <Search className="h-6 w-6 text-[var(--text-muted)]" />
                    <p className="text-sm text-[var(--danger)]">{lookupError}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Make sure this is a valid ERC20 token address on BSC
                    </p>
                  </>
                ) : (
                  <>
                    <Search className="h-6 w-6 text-[var(--text-muted)]" />
                    <p className="text-sm text-[var(--text-secondary)]">
                      {search
                        ? `No tokens matching “${search}”`
                        : erc20Holdings.length === 0
                          ? 'No ERC-20 tokens in holdings. Paste a token address to look it up on-chain.'
                          : 'No tokens found'}
                    </p>
                    {search && addressSearch && !isLooking && !lookupError && !lookupResult ? (
                      <p className="text-xs text-[var(--text-muted)]">Checking on-chain…</p>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              filtered.map((token) => {
                const active = normalizeAddress(token.address) === normalizeAddress(value);
                return (
                  <button
                    key={token.address}
                    type="button"
                    onClick={() => selectToken(token)}
                    className={cn(
                      'token-row flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-100 hover:bg-[var(--bg-depth)]',
                      active && 'border-l-2 border-l-[var(--brand)] bg-[var(--brand-bg)]'
                    )}
                  >
                    <TokenLogo token={token} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{token.symbol}</span>
                        {active ? <span className="text-xs text-[var(--brand)]">✓</span> : null}
                      </div>
                      <p className="truncate text-xs text-[var(--text-muted)]">{token.name}</p>
                      <p className="font-mono text-xs text-[var(--text-muted)]/80">
                        {token.address.slice(0, 10)}…{token.address.slice(-8)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{token.balance}</p>
                      <p className="text-xs text-[var(--text-muted)]">{token.symbol}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--bg-depth)] px-4 py-2">
            <p className="text-xs text-[var(--text-muted)]">
              Holdings from API + saved tokens. Paste any BSC ERC-20 address to look up on-chain.{' '}
              <span className="font-mono text-[var(--text-secondary)]">
                {connectedAddress.slice(0, 6)}…{connectedAddress.slice(-4)}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
