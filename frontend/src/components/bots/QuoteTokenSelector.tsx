import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import gsap from 'gsap';
import { QUOTE_TOKENS, type QuoteTokenConfig } from '../../config/quoteTokens';
import { formatTokenPrice, formatUsdPrice } from '../../utils/formatPrice';
import { useWalletStore, type TokenHolding } from '../../store/walletStore';
import { cn } from '../../lib/utils';

interface QuoteTokenSelectorProps {
  value: string;
  onChange: (address: string, symbol: string) => void;
  error?: string;
  /** Shown on the selected card when listed AMM price is available. */
  priceSnippet?: { priceInQuote: string | null; priceInUsd: string | null } | null;
}

function getBalance(token: QuoteTokenConfig, holdings: TokenHolding[]): string | null {
  if (token.balanceMatch === 'native') {
    const bnb = holdings.find((h) => h.address === 'NATIVE' || h.symbol.toUpperCase() === 'BNB');
    return bnb ? bnb.balance : null;
  }
  const held = holdings.find((h) => h.address.toLowerCase() === token.address.toLowerCase());
  return held ? held.balance : null;
}

export function QuoteTokenSelector({
  value,
  onChange,
  error,
  priceSnippet = null,
}: QuoteTokenSelectorProps): JSX.Element {
  const holdings = useWalletStore((s) => s.holdings);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll('.quote-token-card');
    if (!cards?.length) return;
    gsap.fromTo(
      cards,
      { opacity: 0, scale: 0.92, y: 8 },
      { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'power2.out', stagger: 0.05 }
    );
  }, []);

  return (
    <div>
      <div ref={gridRef} className="grid grid-cols-3 gap-2.5">
        {QUOTE_TOKENS.map((token) => {
          const isSelected = value.toLowerCase() === token.address.toLowerCase();
          const balance = getBalance(token, holdings);
          const balNum = balance != null ? Number(balance) : NaN;
          const balanceLabel =
            balance === null
              ? null
              : Number.isFinite(balNum) && balNum >= 0 && balNum < 0.0001
                ? '<0.0001'
                : Number.isFinite(balNum)
                  ? balNum.toFixed(4)
                  : balance;

          return (
            <button
              key={token.symbol}
              type="button"
              onClick={() => onChange(token.address, token.symbol)}
              className={cn(
                'quote-token-card relative flex flex-col items-center gap-2 rounded-xl border-2 p-3.5 transition-all duration-200',
                isSelected
                  ? 'border-[var(--brand)] bg-[var(--brand-bg)] shadow-[0_0_0_3px_rgba(16,185,129,0.12)]'
                  : 'cursor-pointer border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-depth)]'
              )}
            >
              {isSelected ? (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--brand)]">
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                </span>
              ) : null}

              <img
                src={token.logo}
                alt=""
                className="h-8 w-8 rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (next) next.style.display = 'flex';
                }}
              />
              <div
                className="hidden h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: token.color }}
              >
                {token.symbol[0]}
              </div>

              <span
                className={cn(
                  'text-sm font-semibold',
                  isSelected ? 'text-[var(--brand-dark)]' : 'text-[var(--text-primary)]'
                )}
              >
                {token.symbol}
              </span>

              <div className="flex min-h-[28px] flex-col items-center justify-center text-center">
                {balanceLabel != null ? (
                  <>
                    <p
                      className={cn(
                        'text-xs font-medium tabular-nums',
                        isSelected ? 'text-[var(--brand-dark)]' : 'text-[var(--text-primary)]'
                      )}
                    >
                      {balanceLabel}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">balance</p>
                  </>
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">—</p>
                )}
                {isSelected && priceSnippet?.priceInQuote ? (
                  <div className="mt-1.5 w-full border-t border-[var(--border)] pt-1.5 text-center">
                    {(() => {
                      const pf = formatTokenPrice(priceSnippet.priceInQuote, token.symbol);
                      const uf = formatUsdPrice(priceSnippet.priceInUsd);
                      return (
                        <>
                          <p className="text-xs font-bold tabular-nums leading-tight text-[var(--brand)] break-all">
                            {pf.display}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)]">{uf.display}</p>
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {error ? <p className="mt-1.5 text-xs text-[var(--danger)]">{error}</p> : null}

      {value ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-depth)] px-3 py-2">
          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
          <p className="text-xs text-[var(--text-secondary)]">
            Trading with{' '}
            <span className="font-medium text-[var(--text-primary)]">
              {QUOTE_TOKENS.find((t) => t.address.toLowerCase() === value.toLowerCase())?.symbol ?? 'token'}
            </span>
            <span className="ml-1 font-mono text-[var(--text-muted)]">
              ({value.slice(0, 8)}…{value.slice(-6)})
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
