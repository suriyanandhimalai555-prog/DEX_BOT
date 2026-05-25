import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LimitBanner } from '../components/ui/LimitBanner';
import { Activity, ArrowLeftRight, Bot, TrendingUp, X, Zap } from 'lucide-react';
import { api } from '../api/client';
import { PageWrapper } from '../components/layout/PageWrapper';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/EmptyState';
import { useSocket } from '../hooks/useSocket';
import type { TxRow } from '../api/types';
import { usePageAnimation } from '../hooks/usePageAnimation';
import {
  animateCounter,
  animateTxRowEnter,
  cardHoverEnter,
  cardHoverLeave,
  startPulseDot,
} from '../lib/animations';

function ago(input?: string): string {
  if (!input) return 'just now';
  const t = new Date(input).getTime();
  if (Number.isNaN(t)) return 'just now';
  const diff = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function Dashboard(): JSX.Element {
  const pageRef = usePageAnimation();
  const navigate = useNavigate();
  const socket = useSocket(true);
  const [feed, setFeed] = useState<TxRow[]>([]);
  const [hideOnboarding, setHideOnboarding] = useState(false);
  const liveDotRef = useRef<HTMLSpanElement>(null);
  const statActiveRef = useRef<HTMLDivElement>(null);
  const statTxRef = useRef<HTMLDivElement>(null);
  const statSuccessRef = useRef<HTMLDivElement>(null);
  const statGasRef = useRef<HTMLDivElement>(null);
  const txAnimated = useRef<Set<string>>(new Set());

  const { data, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      const res = await api.get<{
        activeBots: number;
        txToday: number;
        successRatePercent: number;
        gasSpentBNB: number;
      }>('/analytics/summary');
      return res.data;
    },
  });

  const { data: bots, isLoading: botsLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: async () => {
      const res = await api.get<{ bots: { id: string; status: string }[] }>('/bots');
      return res.data.bots;
    },
  });

  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const res = await api.get<{ wallets: { id: string; nativeBalance: string; activeBotCount: number }[] }>('/wallets');
      return res.data.wallets;
    },
  });

  useEffect(() => {
    if (!socket) return;
    const push = (payload: { transaction?: TxRow }): void => {
      if (!payload.transaction) return;
      const t = payload.transaction as TxRow;
      setFeed((prev) => [{ ...t, id: t.id ?? String(Math.random()) }, ...prev].slice(0, 50));
    };
    socket.on('tx:submitted', push);
    socket.on('tx:confirmed', push);
    socket.on('tx:failed', push);
    return () => {
      socket.off('tx:submitted', push);
      socket.off('tx:confirmed', push);
      socket.off('tx:failed', push);
    };
  }, [socket]);

  const totalBots = bots?.length ?? 0;
  const activeBots = data?.activeBots ?? 0;
  const txToday = data?.txToday ?? 0;
  const successRate = data?.successRatePercent ?? 0;
  const gasSpent = data?.gasSpentBNB ?? 0;
  const totalBnb = (wallets ?? []).reduce((sum, w) => sum + (Number(w.nativeBalance) || 0), 0);
  const isBrandNew = !hideOnboarding && totalBots === 0 && (wallets?.length ?? 0) === 0;

  function statusBadge(status?: string): string {
    if (status === 'confirmed')
      return 'border border-[var(--brand)]/40 bg-[var(--brand-bg)] text-[var(--brand-dark)]';
    if (status === 'failed')
      return 'border border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]';
    if (status === 'submitted')
      return 'border border-[var(--info)]/40 bg-[var(--info-bg)] text-[var(--info)]';
    return 'border border-[var(--border)] bg-[var(--bg-depth)] text-[var(--text-secondary)]';
  }

  useEffect(() => {
    if (statActiveRef.current) animateCounter(statActiveRef.current, 0, activeBots);
    if (statTxRef.current) animateCounter(statTxRef.current, 0, txToday);
    if (statSuccessRef.current) animateCounter(statSuccessRef.current, 0, successRate, 0, '%');
    if (statGasRef.current) animateCounter(statGasRef.current, 0, gasSpent, 6);
  }, [activeBots, txToday, successRate, gasSpent]);

  useEffect(() => {
    if (!liveDotRef.current || !socket) return;
    const tween = startPulseDot(liveDotRef.current);
    return () => {
      tween.kill();
    };
  }, [socket]);

  const location = useLocation();
  const base = location.pathname.startsWith('/trader') ? '/trader' : '';

  const txRowRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const key = el.dataset.rowKey;
    if (!key || txAnimated.current.has(key)) return;
    txAnimated.current.add(key);
    animateTxRowEnter(el);
  }, []);

  return (
    <PageWrapper title="">
      <div ref={pageRef}>
        {base === '/trader' && <LimitBanner />}
        {isBrandNew && (
          <div data-animate className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--brand-bg)] p-6">
            <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Welcome to DEX Bot</h3>
              <p className="mt-1 max-w-lg text-sm text-[var(--text-secondary)]">
                Automate token trading on PancakeSwap with smart bots. Follow these 3 steps to get started.
              </p>
            </div>
            <button
              type="button"
              className="text-[var(--text-muted)] transition hover:text-[var(--text-secondary)]"
              onClick={() => setHideOnboarding(true)}
              aria-label="Dismiss onboarding"
            >
              <X className="h-4 w-4" />
            </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Card className="border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-bg)] text-xs font-semibold text-[var(--brand-dark)]">
                  1
                </div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Import a Wallet</div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Add a BSC wallet private key for bot execution.</p>
                <Button type="button" variant="outline" className="mt-3" onClick={() => navigate(`${base}/wallets`)}>
                  Go to Wallets →
                </Button>
              </Card>
              <Card className="border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-depth)] text-xs font-semibold text-[var(--text-secondary)]">
                  2
                </div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Create a Bot</div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Set strategy, pair, size range, and interval.</p>
                <Button type="button" variant="outline" className="mt-3" onClick={() => navigate(`${base}/bots`)}>
                  Create Bot →
                </Button>
              </Card>
              <Card className="border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-depth)] text-xs font-semibold text-[var(--text-secondary)]">
                  3
                </div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Monitor & Profit</div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Track live transactions and analytics in real time.</p>
                <Button type="button" variant="outline" className="mt-3" onClick={() => navigate(`${base}/analytics`)}>
                  View Analytics →
                </Button>
              </Card>
            </div>
          </div>
        )}

        {summaryLoading || botsLoading || walletsLoading ? (
          <div data-animate className="grid gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((k) => (
              <Card key={k} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="skeleton h-9 w-9 rounded-lg" />
                  <div className="skeleton h-3 w-24 rounded" />
                </div>
                <div className="skeleton mb-2 h-8 w-16 rounded" />
                <div className="skeleton h-3 w-28 rounded" />
              </Card>
            ))}
          </div>
        ) : (
        <div data-animate className="grid gap-4 lg:grid-cols-4">
          <Card
            data-gsap
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
            onMouseEnter={(e) => cardHoverEnter(e.currentTarget)}
            onMouseLeave={(e) => cardHoverLeave(e.currentTarget)}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-lg bg-[var(--brand-bg)] p-2 text-[var(--brand-dark)]">
                <Bot className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium text-[var(--text-secondary)]">Active Bots</div>
            </div>
            <div ref={statActiveRef} className="stat-number text-3xl font-bold text-[var(--text-primary)]">
              {activeBots}
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">of {totalBots} total bots</div>
          </Card>
          <Card
            data-gsap
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
            onMouseEnter={(e) => cardHoverEnter(e.currentTarget)}
            onMouseLeave={(e) => cardHoverLeave(e.currentTarget)}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-lg bg-[var(--info-bg)] p-2 text-[var(--info)]">
                <ArrowLeftRight className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium text-[var(--text-secondary)]">Today's Transactions</div>
            </div>
            <div ref={statTxRef} className="stat-number text-3xl font-bold text-[var(--text-primary)]">
              {txToday}
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">across all active bots</div>
          </Card>
          <Card
            data-gsap
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
            onMouseEnter={(e) => cardHoverEnter(e.currentTarget)}
            onMouseLeave={(e) => cardHoverLeave(e.currentTarget)}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-lg bg-[var(--admin-bg)] p-2 text-[var(--admin)]">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium text-[var(--text-secondary)]">Success Rate</div>
            </div>
            <div ref={statSuccessRef} className="stat-number text-3xl font-bold text-[var(--text-primary)]">
              {successRate}%
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">last 24 hours</div>
          </Card>
          <Card
            data-gsap
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
            onMouseEnter={(e) => cardHoverEnter(e.currentTarget)}
            onMouseLeave={(e) => cardHoverLeave(e.currentTarget)}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-lg bg-[var(--warning-bg)] p-2 text-[var(--warning)]">
                <Zap className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium text-[var(--text-secondary)]">Gas Spent (BNB)</div>
            </div>
            <div ref={statGasRef} className="stat-number text-3xl font-bold text-[var(--text-primary)]">
              {gasSpent.toFixed(6)}
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">wallet total ≈ {totalBnb.toFixed(4)} BNB</div>
          </Card>
        </div>
        )}

        <Card data-animate className="mt-6 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <span
                ref={liveDotRef}
                data-gsap
                className={`h-2 w-2 rounded-full ${socket ? 'bg-[var(--brand)]' : 'bg-[var(--text-muted)]'}`}
              />
              Live Transactions
            </div>
            <span className="badge-live rounded-full border border-[var(--brand)]/40 bg-[var(--brand-bg)] px-2 py-0.5 text-xs font-medium text-[var(--brand-dark)]">
              Real-time
            </span>
          </div>

          <div className="max-h-[28rem] overflow-auto text-sm">
            {feed.length === 0 && (
              <EmptyState
                icon={Activity}
                title="No transactions yet"
                description="Start a bot to see live transaction activity here. Each swap will appear in real time."
                action={
                  <Button type="button" variant="outline" onClick={() => navigate(`${base}/bots`)}>
                    Create your first bot →
                  </Button>
                }
              />
            )}
            {feed.map((t) => {
              const rowKey = `${t.txHash ?? t.id}-${t.createdAt}`;
              return (
                <div
                  key={rowKey}
                  ref={txRowRef}
                  data-row-key={rowKey}
                  data-gsap
                  className="table-row flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-3"
                >
                  <span
                    className={
                      t.side === 'buy'
                        ? 'rounded-full border border-[var(--brand)]/40 bg-[var(--brand-bg)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--brand-dark)]'
                        : 'rounded-full border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--danger)]'
                    }
                  >
                    {t.side}
                  </span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">BSC Swap</span>
                  <span className="text-sm text-[var(--text-secondary)]">{t.inputAmount}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(t.status)}`}>
                    {t.status}
                  </span>
                  <span className="font-mono text-xs text-[var(--text-muted)]">{t.walletAddress?.slice(0, 8)}…</span>
                  {t.txHash && (
                    <a
                      className="text-xs text-[var(--brand)] underline"
                      href={`https://bscscan.com/tx/${t.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      BscScan ↗
                    </a>
                  )}
                  <span className="ml-auto text-xs text-[var(--text-muted)]">{ago(t.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
}
