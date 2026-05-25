import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Bot, Plus, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import type { BotSummary } from '../api/types';
import { BotCard } from '../components/bots/BotCard';
import { BotForm, type BotFormValues } from '../components/bots/BotForm';
import { PageWrapper } from '../components/layout/PageWrapper';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/EmptyState';
import { usePageAnimation } from '../hooks/usePageAnimation';
import { useBotLifecycleMutation } from '../hooks/useBotLifecycleMutation';
import { confirmBotLifecycleAction } from '../lib/botLifecycleConfirm';
import { useAuth } from '../context/AuthContext';

export function Bots(): JSX.Element {
  const pageRef = usePageAnimation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);

  const { data: bots, isLoading: botsLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: async () => {
      const res = await api.get<{ bots: BotSummary[] }>('/bots');
      return res.data.bots;
    },
  });

  const { data: groups } = useQuery({
    queryKey: ['wallet-groups'],
    queryFn: async () => {
      const res = await api.get<{ groups: { id: string; name: string }[] }>('/wallets/groups');
      return res.data.groups;
    },
  });

  const createBot = useMutation({
    mutationFn: async (values: BotFormValues) => {
      const maxDailyNotionalUSD =
        user?.role === 'admin' ? values.maxDailyNotionalUSD : (user?.tradeLimitUSD ?? 1);
      await api.post('/bots', {
        ...values,
        gasPolicy: { mode: 'auto' as const },
        riskPolicy: {
          maxDailyNotionalUSD,
          cooldownOnFailureSeconds: 120,
          maxConcurrentWallets: 3,
        },
      });
    },
    onSuccess: async () => {
      toast.success('Bot created');
      setShowForm(false);
      await qc.invalidateQueries({ queryKey: ['bots'] });
    },
    onError: () => toast.error('Failed to create bot'),
  });

  const lifecycle = useBotLifecycleMutation();

  const deleteBot = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/bots/${id}`);
    },
    onSuccess: async () => {
      toast.success('Bot deleted');
      await qc.invalidateQueries({ queryKey: ['bots'] });
    },
    onError: (err) => {
      const data = axios.isAxiosError(err) ? (err.response?.data as { message?: string } | undefined) : undefined;
      const msg = data?.message && typeof data.message === 'string' ? data.message : 'Could not delete bot.';
      toast.error(msg);
    },
  });

  return (
    <PageWrapper
      title="Bots"
      actions={
        <Button type="button" className="bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New Bot
        </Button>
      }
    >
      <div ref={pageRef} className="space-y-4">
        {showForm && groups && (
          <BotForm
            groups={groups}
            isSubmitting={createBot.isPending}
            onClose={() => setShowForm(false)}
            onSubmit={async (v) => {
              await createBot.mutateAsync(v);
            }}
          />
        )}

        {botsLoading ? (
          <div data-animate className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((k) => (
              <div key={k} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                <div className="mb-3 flex justify-between">
                  <div className="skeleton h-4 w-32 rounded" />
                  <div className="skeleton h-5 w-16 rounded-full" />
                </div>
                <div className="skeleton mb-3 h-3 w-48 rounded" />
                <div className="grid grid-cols-3 gap-2">
                  <div className="skeleton h-10 rounded" />
                  <div className="skeleton h-10 rounded" />
                  <div className="skeleton h-10 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (bots?.length ?? 0) > 0 ? (
          <>
            <div data-animate className="mb-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="text-xs text-[var(--text-secondary)]">Total Bots</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">{bots?.length ?? 0}</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="text-xs text-[var(--text-secondary)]">Active</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {bots?.filter((b) => b.status === 'active').length ?? 0}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="text-xs text-[var(--text-secondary)]">Draft / Paused</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {bots?.filter((b) => b.status === 'draft' || b.status === 'paused').length ?? 0}
                </div>
              </div>
            </div>

            <div data-animate className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bots?.map((b) => (
                <BotCard
                  key={b.id}
                  bot={b}
                  deleteInProgress={deleteBot.isPending && deleteBot.variables === b.id}
                  onStart={() => {
                    confirmBotLifecycleAction(
                      b.status === 'stopped' ? 'Restart this bot?' : 'Start this bot?',
                      b.status === 'stopped'
                        ? 'The bot will schedule trades again with your saved settings.'
                        : 'The bot will begin scheduling trades on BSC. Confirm only if you are ready.',
                      () => lifecycle.mutate({ id: b.id, action: 'start' })
                    );
                  }}
                  onPause={() => lifecycle.mutate({ id: b.id, action: 'pause' })}
                  onResume={() => lifecycle.mutate({ id: b.id, action: 'resume' })}
                  onStop={() => {
                    confirmBotLifecycleAction(
                      'Stop this bot?',
                      'Execution stops after this action. You can restart later.',
                      () => lifecycle.mutate({ id: b.id, action: 'stop' })
                    );
                  }}
                  onDelete={() => {
                    confirmBotLifecycleAction(
                      'Delete this bot?',
                      'This permanently removes the bot and its configuration. This cannot be undone.',
                      () => deleteBot.mutate(b.id)
                    );
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <div data-animate className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-10">
            <EmptyState
              icon={Bot}
              title="No Bots Created Yet"
              description="Create your first bot to automate DEX trading. Choose your strategy, risk settings, and wallet group."
              action={
                <Button
                  type="button"
                  className="mt-5 bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
                  onClick={() => setShowForm(true)}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Create Your First Bot
                </Button>
              }
            />
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-depth)] p-3 text-left">
                <div className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)]">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]" />
                  Smooth Buy
                </div>
                <p className="text-xs text-[var(--text-secondary)]">Accumulates tokens over time with randomized buy execution.</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-depth)] p-3 text-left">
                <div className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)]">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]" />
                  Smooth Sell
                </div>
                <p className="text-xs text-[var(--text-secondary)]">Gradually exits positions with interval-based sell behavior.</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-depth)] p-3 text-left">
                <div className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)]">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]" />
                  Volume Cycle
                </div>
                <p className="text-xs text-[var(--text-secondary)]">Alternates buys and sells to create controlled market activity.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
