import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, CircleDollarSign } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';
import { PageWrapper } from '../components/layout/PageWrapper';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { usePageAnimation } from '../hooks/usePageAnimation';
import { scrollReveal } from '../lib/animations';

export function Analytics(): JSX.Element {
  const pageRef = usePageAnimation();
  const volumeCardRef = useRef<HTMLDivElement>(null);
  const successCardRef = useRef<HTMLDivElement>(null);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: volume, isLoading: volumeLoading } = useQuery({
    queryKey: ['analytics-volume', from, to],
    queryFn: async () => {
      const res = await api.get('/analytics/volume', { params: { from, to } });
      return res.data as { byStrategy: { _id: string; volumeWei: number; count: number }[] };
    },
  });

  const barData = useMemo(
    () =>
      volume?.byStrategy.map((r) => ({
        name: r._id,
        volume: r.volumeWei,
      })) ?? [],
    [volume]
  );

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      const res = await api.get('/analytics/summary');
      return res.data as { successRatePercent: number };
    },
  });

  const lineData = [{ t: 'today', rate: summary?.successRatePercent ?? 0 }];
  const totalVolume = barData.reduce((sum, item) => sum + (Number(item.volume) || 0), 0);

  useEffect(() => {
    if (volumeCardRef.current) scrollReveal(volumeCardRef.current);
    if (successCardRef.current) scrollReveal(successCardRef.current);
  }, []);

  return (
    <PageWrapper title="Analytics">
      <div ref={pageRef} className="space-y-4">
        <div data-animate className="mb-4 grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            Strategies Tracked
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">{barData.length}</div>
        </Card>
        <Card className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <CircleDollarSign className="h-4 w-4 text-[var(--brand)]" />
            Aggregate Volume (wei)
          </div>
          <div className="truncate text-2xl font-bold text-[var(--text-primary)]">{totalVolume.toLocaleString()}</div>
        </Card>
        <Card className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Activity className="h-4 w-4 text-purple-600" />
            Success Rate
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">{summary?.successRatePercent ?? 0}%</div>
        </Card>
      </div>

        <Card data-animate className="mb-4 flex flex-wrap gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <div>
          <div className="text-xs text-[var(--text-secondary)]">From</div>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-[var(--text-secondary)]">To</div>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

        <div data-animate className="grid gap-4 lg:grid-cols-2">
          <Card ref={volumeCardRef} data-gsap className="h-80 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="mb-2 text-sm font-medium text-[var(--text-primary)]">Volume by Strategy</div>
          {volumeLoading ? (
            <div className="space-y-3 p-2">
              <div className="skeleton h-6 w-full rounded" />
              <div className="skeleton h-6 w-5/6 rounded" />
              <div className="skeleton h-6 w-4/6 rounded" />
            </div>
          ) : barData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip />
                <Bar dataKey="volume" fill="var(--brand)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[90%] items-center justify-center text-sm text-[var(--text-muted)]">
              No strategy volume data for selected range.
            </div>
          )}
        </Card>

          <Card ref={successCardRef} data-gsap className="h-80 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="mb-2 text-sm font-medium text-[var(--text-primary)]">Success Rate Snapshot</div>
          {summaryLoading ? (
            <div className="space-y-3 p-2">
              <div className="skeleton h-6 w-full rounded" />
              <div className="skeleton h-6 w-3/4 rounded" />
              <div className="skeleton h-6 w-2/3 rounded" />
            </div>
          ) : (summary?.successRatePercent ?? 0) > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <XAxis dataKey="t" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="var(--brand)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[90%] items-center justify-center text-sm text-[var(--text-muted)]">
              No success-rate data available yet.
            </div>
          )}
        </Card>
        </div>

        <Card data-animate className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <div className="mb-2 text-sm font-medium text-[var(--text-primary)]">Transaction History</div>
        <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
          Transaction-level analytics table shell is ready. Data appears as trading history grows.
        </div>
        </Card>
      </div>
    </PageWrapper>
  );
}
