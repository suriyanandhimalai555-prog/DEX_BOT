import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  XCircle,
  Zap,
} from 'lucide-react';
import type { PriceCheckResult } from '../../hooks/usePriceCheck';
import {
  classifyPriceStatus,
  formatTokenPrice,
  formatUsdPrice,
  type PriceStatus,
} from '../../utils/formatPrice';
import { cn } from '../../lib/utils';
import {
  getAlternateDexLabels,
  getDexLabel,
  type DexId,
  type DexVersion,
} from '../../config/dexOptions';

interface TokenPriceDisplayProps {
  loading: boolean;
  data: PriceCheckResult | null;
  error: string | null;
  baseSymbol: string;
  quoteSymbol: string;
  dex: DexId;
  dexVersion: DexVersion;
  onRefresh: () => void;
  className?: string;
}

export function TokenPriceDisplay({
  loading,
  data,
  error,
  baseSymbol,
  quoteSymbol,
  dex,
  dexVersion,
  onRefresh,
  className,
}: TokenPriceDisplayProps): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevPriceRef = useRef<string | null>(null);
  const dexLabel = getDexLabel(dex, dexVersion);

  useEffect(() => {
    if (!containerRef.current) return;
    if (data || error) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
      );
    }
  }, [!!data, !!error]);

  useEffect(() => {
    const el = containerRef.current?.querySelector('[data-price-value]') as HTMLElement | null;
    if (el && data?.priceInQuote && data.priceInQuote !== prevPriceRef.current) {
      gsap.fromTo(
        el,
        { color: 'var(--brand)' },
        { color: 'var(--text-primary)', duration: 1.5, ease: 'power2.out' }
      );
      prevPriceRef.current = data.priceInQuote;
    }
  }, [data?.priceInQuote]);

  if (loading && !data) {
    return (
      <div
        className={cn(
          'mt-4 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-depth)] px-4 py-3.5',
          className
        )}
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--text-muted)]" />
        <div>
          <p className="text-sm text-[var(--text-secondary)]">
            Checking {baseSymbol}/{quoteSymbol} price on {dexLabel}…
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Querying AMM pool directly</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--danger)]/35 bg-[var(--danger-bg)] px-4 py-3.5',
          className
        )}
      >
        <div className="flex items-center gap-2.5">
          <XCircle className="h-4 w-4 shrink-0 text-[var(--danger)]" />
          <div>
            <p className="text-sm font-medium text-[var(--danger)]">Could not fetch price</p>
            <p className="mt-0.5 text-xs text-[var(--danger)]/90">{error}</p>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1.5 text-[var(--danger)] transition-colors hover:bg-[var(--bg-surface)]"
          onClick={() => onRefresh()}
          aria-label="Retry"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (!data) return null;

  const status: PriceStatus = classifyPriceStatus(
    data.listed,
    data.liquidityWarning,
    data.priceInUsd,
    data.priceInQuote
  );
  const priceFormatted = formatTokenPrice(data.priceInQuote, quoteSymbol);
  const usdFormatted = formatUsdPrice(data.priceInUsd);
  const alternateDexLabels = getAlternateDexLabels(dex, dexVersion);

  if (status === 'not_listed') {
    return (
      <div
        ref={containerRef}
        className={cn(
          'mt-4 overflow-hidden rounded-xl border border-[var(--danger)]/35 bg-[var(--danger-bg)]',
          className
        )}
      >
        <div className="flex items-start gap-3 p-4">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--danger)]/15">
            <XCircle className="h-4 w-4 text-[var(--danger)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {baseSymbol} has no liquidity pool on {dexLabel}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              {data.error ??
                `No trading pair found for ${baseSymbol}/${quoteSymbol}. This token cannot be traded with this router.`}
            </p>
          </div>
        </div>

        <div className="space-y-2 border-t border-[var(--danger)]/20 px-4 py-3">
          <p className="text-xs font-medium text-[var(--text-primary)]">Try these fixes:</p>
          <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
            {alternateDexLabels.length > 0 ? (
              <p>
                Go back to <strong className="font-medium text-[var(--text-primary)]">Step 1</strong> and try{' '}
                <strong className="font-medium text-[var(--text-primary)]">
                  {alternateDexLabels.join(' or ')}
                </strong>{' '}
                — liquidity may exist on another router.
              </p>
            ) : null}
            <p>
              Select a different <strong className="font-medium text-[var(--text-primary)]">quote token</strong> — try
              BNB if you have not already.
            </p>
            <p>
              Verify the token contract on <strong className="font-medium text-[var(--text-primary)]">BscScan</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = {
    healthy: {
      headerBg: 'bg-[var(--brand-bg)]',
      headerBorder: 'border-[var(--brand)]/25',
      headerText: 'text-[var(--brand-dark)]',
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-[var(--brand)]" />,
      label: `Listed on ${dexLabel}`,
    },
    low_liquidity: {
      headerBg: 'bg-[var(--warning-bg)]',
      headerBorder: 'border-[var(--warning)]/35',
      headerText: 'text-[var(--text-primary)]',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-[var(--warning)]" />,
      label: `Listed on ${dexLabel} — low liquidity`,
    },
    micro_price: {
      headerBg: 'bg-[var(--warning-bg)]',
      headerBorder: 'border-[var(--warning)]/35',
      headerText: 'text-[var(--text-primary)]',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-[var(--warning)]" />,
      label: `Listed on ${dexLabel} — very low price`,
    },
  }[status];

  const poolFeePct = data.poolFee != null ? data.poolFee / 10_000 : null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b px-4 py-2.5',
          statusConfig.headerBg,
          statusConfig.headerBorder
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {statusConfig.icon}
          <span className={cn('text-xs font-semibold', statusConfig.headerText)}>{statusConfig.label}</span>
          {poolFeePct != null ? (
            <span className="text-xs text-[var(--text-muted)]">· {poolFeePct.toFixed(2)}% fee tier</span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={loading}
          title="Refresh price from chain"
          className="shrink-0 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]"
          onClick={() => onRefresh()}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {baseSymbol} price in {quoteSymbol}
            </p>
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span
                data-price-value
                className="text-2xl font-bold tabular-nums leading-none text-[var(--text-primary)] break-all"
              >
                {priceFormatted.display}
              </span>
              <span className="text-sm font-medium text-[var(--text-secondary)]">{quoteSymbol}</span>
            </div>

            {priceFormatted.isMicro && !priceFormatted.isZero ? (
              <div className="mt-1.5 flex items-start gap-1.5">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                <p className="break-all font-mono text-[10px] text-[var(--text-muted)]">
                  Exact: {priceFormatted.exact} {quoteSymbol}
                </p>
              </div>
            ) : null}

            {data.route.length > 2 ? (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                <Zap className="h-3 w-3 shrink-0" />
                <span>Route: {data.route.join(' → ')}</span>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 text-right">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              USD value
            </p>
            <p
              className={cn(
                'text-xl font-bold tabular-nums leading-none',
                usdFormatted.isMicro ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'
              )}
            >
              {usdFormatted.display}
            </p>
            {usdFormatted.isMicro && !usdFormatted.isZero ? (
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">Sub-cent / micro-cap range</p>
            ) : null}
          </div>
        </div>
      </div>

      {status === 'low_liquidity' ? (
        <div className="mx-4 mb-4 flex items-start gap-3 rounded-xl border border-[var(--warning)]/35 bg-[var(--warning-bg)] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
          <div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">Low pool liquidity detected</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
              A larger simulated trade shows meaningful price impact (&gt; 5%). Use small trade sizes and appropriate
              slippage to reduce failed transactions.
            </p>
          </div>
        </div>
      ) : null}

      {status === 'micro_price' ? (
        <div className="mx-4 mb-4 flex items-start gap-3 rounded-xl border border-[var(--warning)]/35 bg-[var(--warning-bg)] px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
          <div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">Very low unit price</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
              The quoted price per token is extremely small. That can reflect high supply, many decimals, or thin
              liquidity. Confirm this is the token you intend before continuing.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
