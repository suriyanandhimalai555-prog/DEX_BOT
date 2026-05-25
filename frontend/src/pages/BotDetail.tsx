import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePanelBase } from '../hooks/usePanelBase';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeft, Pause, Play, Square } from 'lucide-react';
import { api } from '../api/client';
import type { BotDetailRecord, BotRunRow } from '../api/types';
import { PageWrapper } from '../components/layout/PageWrapper';
import { getDexLabel } from '../config/dexOptions';
import { BotExecutionLog } from '../components/bots/BotExecutionLog';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useSocket } from '../hooks/useSocket';
import { usePageAnimation } from '../hooks/usePageAnimation';
import { useBotLifecycleMutation } from '../hooks/useBotLifecycleMutation';
import { confirmBotLifecycleAction } from '../lib/botLifecycleConfirm';
import { truncateAddress } from '../lib/utils';

const STRATEGY_LABELS: Record<string, string> = {
  smooth_buy: 'Smooth buy',
  smooth_sell: 'Smooth sell',
  volume_cycle: 'Volume cycle',
};


function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="grid gap-1 border-b border-[var(--border)] py-3 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start sm:gap-4">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="break-words text-sm text-[var(--text-primary)]">{children}</div>
    </div>
  );
}

function statusBadgeClass(status: string): string {
  const base = 'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize';
  switch (status) {
    case 'active':
      return `${base} border border-[var(--brand)]/40 bg-[var(--brand-bg)] text-[var(--brand-dark)]`;
    case 'paused':
      return `${base} border border-amber-500/35 bg-[var(--warning-bg)] text-[var(--warning)]`;
    case 'draft':
      return `${base} border border-[var(--border)] bg-[var(--bg-depth)] text-[var(--text-secondary)]`;
    case 'stopped':
      return `${base} border border-[var(--text-muted)]/30 bg-[var(--bg-depth)] text-[var(--text-secondary)]`;
    case 'errored':
      return `${base} border border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]`;
    default:
      return `${base} border border-[var(--border)] bg-[var(--bg-depth)] text-[var(--text-secondary)]`;
  }
}

export function BotDetail(): JSX.Element {
  const pageRef = usePageAnimation();
  const { id } = useParams();
  const base = usePanelBase();
  const socket = useSocket(true);
  const lifecycle = useBotLifecycleMutation();
  const [rows, setRows] = useState<{ time: string; price?: string; status: string }[]>([]);
  const [rawOpen, setRawOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bot', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/bots/${id}`);
      return res.data as { bot: BotDetailRecord; runs: BotRunRow[] };
    },
  });

  const bot = data?.bot;

  const { data: txs } = useQuery({
    queryKey: ['bot-txs', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<{ transactions: { quotedPrice?: string; createdAt: string; status: string }[] }>(
        `/bots/${id}/transactions?limit=50`
      );
      return res.data.transactions;
    },
  });

  useEffect(() => {
    const seed =
      txs?.map((t) => ({
        time: new Date(t.createdAt).toLocaleTimeString(),
        price: t.quotedPrice,
        status: t.status,
      })) ?? [];
    setRows(seed);
  }, [txs]);

  useEffect(() => {
    if (!socket || !id) return;
    const onTx = (payload: {
      transaction?: { botId?: string | { toString(): string }; quotedPrice?: string; createdAt?: string; status?: string };
    }): void => {
      const t = payload.transaction;
      const bid = t?.botId != null ? String(t.botId) : '';
      if (!t || bid !== String(id)) return;
      setRows((prev) =>
        [
          {
            time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : new Date().toLocaleTimeString(),
            price: t.quotedPrice,
            status: t.status ?? 'submitted',
          },
          ...prev,
        ].slice(0, 80)
      );
    };
    socket.on('tx:submitted', onTx);
    socket.on('tx:confirmed', onTx);
    socket.on('tx:failed', onTx);
    return () => {
      socket.off('tx:submitted', onTx);
      socket.off('tx:confirmed', onTx);
      socket.off('tx:failed', onTx);
    };
  }, [socket, id]);

  const chartData = useMemo(
    () =>
      rows
        .filter((r) => r.price != null && r.price !== '')
        .map((r, i) => ({
          i,
          p: Number(r.price),
        })),
    [rows]
  );

  const strategyLabel = bot ? STRATEGY_LABELS[bot.strategyType] ?? bot.strategyType : '';
  const dexLabel = bot
    ? (bot.dexLabel ?? getDexLabel(bot.dex ?? 'pancakeswap', bot.dexVersion))
    : '';

  function requestStart(): void {
    if (!id || !bot) return;
    const isRestart = bot.status === 'stopped';
    confirmBotLifecycleAction(
      isRestart ? 'Restart this bot?' : 'Start this bot?',
      isRestart
        ? 'The bot will schedule trades again using your saved settings. Make sure wallets and balances are ready.'
        : 'Once started, the bot will begin scheduling trades on BSC. Confirm only if you understand the risk.',
      () => lifecycle.mutate({ id, action: 'start' })
    );
  }

  function requestStop(): void {
    if (!id) return;
    confirmBotLifecycleAction(
      'Stop this bot?',
      'Execution will stop after this action. You can start or restart it later from the bots list or this page.',
      () => lifecycle.mutate({ id, action: 'stop' })
    );
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link to={`${base}/bots`}>
        <Button type="button" variant="outline" className="gap-1.5 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
      </Link>
      {bot && id ? (
        <>
          {bot.status === 'draft' && (
            <Button type="button" className="gap-1.5 text-xs" disabled={lifecycle.isPending} onClick={requestStart}>
              <Play className="h-3.5 w-3.5" />
              Start
            </Button>
          )}
          {bot.status === 'active' && (
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 text-xs"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate({ id, action: 'pause' })}
              >
                <Pause className="h-3.5 w-3.5" />
                Pause
              </Button>
              <Button type="button" variant="danger" className="gap-1.5 text-xs" disabled={lifecycle.isPending} onClick={requestStop}>
                <Square className="h-3.5 w-3.5" />
                Stop
              </Button>
            </>
          )}
          {bot.status === 'paused' && (
            <>
              <Button
                type="button"
                className="gap-1.5 text-xs"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate({ id, action: 'resume' })}
              >
                <Play className="h-3.5 w-3.5" />
                Resume
              </Button>
              <Button type="button" variant="danger" className="gap-1.5 text-xs" disabled={lifecycle.isPending} onClick={requestStop}>
                <Square className="h-3.5 w-3.5" />
                Stop
              </Button>
            </>
          )}
          {(bot.status === 'stopped' || bot.status === 'errored') && (
            <Button type="button" className="gap-1.5 text-xs" disabled={lifecycle.isPending} onClick={requestStart}>
              <Play className="h-3.5 w-3.5" />
              Restart
            </Button>
          )}
        </>
      ) : null}
    </div>
  );

  return (
    <PageWrapper title={String(bot?.name ?? 'Bot details')} actions={actions}>
      <div ref={pageRef} className="space-y-4">
        {isLoading && (
          <Card data-animate className="space-y-3 p-5">
            <div className="skeleton h-6 w-40 rounded" />
            <div className="skeleton h-48 w-full rounded-lg" />
          </Card>
        )}

        {isError && (
          <Card data-animate className="border-[var(--danger)]/35 bg-[var(--danger-bg)] p-5 text-sm text-[var(--danger)]">
            Could not load this bot.{' '}
            <Link className="font-medium underline" to={`${base}/bots`}>
              Return to Bots
            </Link>
          </Card>
        )}

        {bot && (
          <>
            <Card data-animate className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)]">{bot.name}</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Binance Smart Chain · {dexLabel}
                  </p>
                </div>
                <span className={statusBadgeClass(bot.status)}>{bot.status.replace('_', ' ')}</span>
              </div>
              <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
                <div className="bg-[var(--bg-surface)] p-4">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Failures (streak)</div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{bot.consecutiveFailures}</div>
                </div>
                <div className="bg-[var(--bg-surface)] p-4">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Last run</div>
                  <div className="mt-1 text-sm text-[var(--text-primary)]">
                    {bot.lastRunAt ? new Date(bot.lastRunAt).toLocaleString() : 'Never'}
                  </div>
                </div>
                <div className="bg-[var(--bg-surface)] p-4">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Cooldown / daily cap</div>
                  <div className="mt-1 text-sm text-[var(--text-primary)]">
                    {bot.riskPolicy.cooldownOnFailureSeconds}s on fail · ${bot.riskPolicy.maxDailyNotionalUSD}/day max
                  </div>
                </div>
              </div>
            </Card>

            <Card data-animate className="p-5">
              <div className="mb-1 text-base font-semibold text-[var(--text-primary)]">Configuration</div>
              <p className="mb-4 text-xs text-[var(--text-secondary)]">What this bot trades, how often, and your risk envelope.</p>
              <div>
                <DetailRow label="Strategy">{strategyLabel}</DetailRow>
                <DetailRow label="DEX / router">
                  <div>{dexLabel}</div>
                  {bot.routerAddress ? (
                    <span className="mt-1 block font-mono text-xs text-[var(--text-muted)]" title={bot.routerAddress}>
                      Router: {bot.routerAddress}
                    </span>
                  ) : null}
                </DetailRow>
                <DetailRow label="Base token">
                  <span className="font-mono text-xs" title={bot.baseToken}>
                    {truncateAddress(bot.baseToken, 6, 4)}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)]">{bot.baseToken}</span>
                </DetailRow>
                <DetailRow label="Quote token">
                  <span className="font-mono text-xs" title={bot.quoteToken}>
                    {truncateAddress(bot.quoteToken, 6, 4)}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)]">{bot.quoteToken}</span>
                </DetailRow>
                <DetailRow label="Buy / sell">
                  {bot.buyEnabled ? 'Buys allowed' : 'Buys off'} · {bot.sellEnabled ? 'Sells allowed' : 'Sells off'}
                </DetailRow>
                <DetailRow label="Order size (wei)">
                  Min {bot.amountMin} — Max {bot.amountMax}
                </DetailRow>
                <DetailRow label="Interval">{bot.intervalSeconds}s between runs (min 30)</DetailRow>
                <DetailRow label="Slippage">{(bot.slippageBps / 100).toFixed(2)}% ({bot.slippageBps} bps)</DetailRow>
                <DetailRow label="Gas">{bot.gasPolicy.mode === 'auto' ? 'Auto' : `Fixed${bot.gasPolicy.maxGweiOverride != null ? ` · ${bot.gasPolicy.maxGweiOverride} gwei` : ''}`}</DetailRow>
                <DetailRow label="Concurrency">At most {bot.riskPolicy.maxConcurrentWallets} wallets per wave</DetailRow>
              </div>
            </Card>

            {id ? (
              <Card data-animate className="p-5">
                <div className="mb-3 text-base font-semibold text-[var(--text-primary)]">Live execution log</div>
                <p className="mb-3 text-xs text-[var(--text-secondary)]">
                  Streams worker milestones and swap events for this bot when you stay on this page.
                </p>
                <BotExecutionLog botId={id} />
              </Card>
            ) : null}

            {data?.runs && data.runs.length > 0 && (
              <Card data-animate className="p-5">
                <div className="mb-3 text-base font-semibold text-[var(--text-primary)]">Recent runs</div>
                <div className="max-h-52 overflow-auto text-xs" data-lenis-prevent-wheel>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                        <th className="py-2 pr-2 font-medium">Started</th>
                        <th className="py-2 pr-2 font-medium">Status</th>
                        <th className="py-2 font-medium text-right">Intents ok / fail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.runs.map((r) => (
                        <tr key={r.id} className="border-b border-[var(--border)]/80 text-[var(--text-primary)]">
                          <td className="py-2 pr-2">
                            {r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}
                          </td>
                          <td className="py-2 pr-2 capitalize">{r.status}</td>
                          <td className="py-2 text-right text-[var(--text-secondary)]">
                            {r.successCount ?? '—'} / {r.failureCount ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <Card data-animate className="p-5">
              <div className="mb-3 text-base font-semibold text-[var(--text-primary)]">Execution price (quoted)</div>
              <div className="h-64 space-y-2">
                {chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-depth)] px-4 text-center text-sm text-[var(--text-muted)]">
                    No quoted prices yet. Values appear after the bot executes swaps and the server records quotes.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis dataKey="i" hide />
                      <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          color: 'var(--text-primary)',
                        }}
                      />
                      <Line type="monotone" dataKey="p" stroke="var(--brand)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card data-animate className="p-5">
              <div className="mb-3 text-base font-semibold text-[var(--text-primary)]">Recent executions</div>
              <div className="max-h-96 overflow-auto text-xs" data-lenis-prevent-wheel>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                      <th className="p-2 font-medium">Time</th>
                      <th className="p-2 font-medium">Price</th>
                      <th className="p-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-6 text-center text-[var(--text-muted)]">
                          No executions recorded for this session yet.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, idx) => (
                        <tr key={`${r.time}-${idx}`} className="border-t border-[var(--border)] text-[var(--text-primary)]">
                          <td className="p-2">{r.time}</td>
                          <td className="p-2">{r.price ?? '—'}</td>
                          <td className="p-2 capitalize">{r.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card data-animate className="border-[var(--border)] p-5">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left text-sm font-medium text-[var(--text-primary)]"
                onClick={() => setRawOpen((o) => !o)}
                aria-expanded={rawOpen}
              >
                Raw JSON (advanced)
                <span className="text-xs text-[var(--text-muted)]">{rawOpen ? 'Hide' : 'Show'}</span>
              </button>
              {rawOpen && (
                <pre
                  className="mt-3 max-h-64 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg-depth)] p-3 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]"
                  data-lenis-prevent-wheel
                >
                  {JSON.stringify(bot, null, 2)}
                </pre>
              )}
            </Card>
          </>
        )}
      </div>
    </PageWrapper>
  );
}
