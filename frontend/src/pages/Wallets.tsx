import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { MoreHorizontal, Plus, Wallet } from 'lucide-react';
import { api } from '../api/client';
import type { WalletRow } from '../api/types';
import { ImportWalletDialog } from '../components/wallets/ImportWalletDialog';
import { PageWrapper } from '../components/layout/PageWrapper';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { usePageAnimation } from '../hooks/usePageAnimation';
import { animateModalEnter, animateModalExit } from '../lib/animations';
import { getLenis } from '../lib/lenis';
import { EmptyState } from '../components/ui/EmptyState';

export function Wallets(): JSX.Element {
  const pageRef = usePageAnimation();
  const qc = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const groupOverlayRef = useRef<HTMLDivElement>(null);
  const groupPanelRef = useRef<HTMLDivElement>(null);

  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const res = await api.get<{ wallets: WalletRow[] }>('/wallets');
      return res.data.wallets;
    },
  });

  const createGroup = useMutation({
    mutationFn: async () => {
      await api.post('/wallets/groups', { name: groupName, walletIds: selected });
    },
    onSuccess: async () => {
      toast.success('Group created');
      setGroupOpen(false);
      setGroupName('');
      setSelected([]);
      await qc.invalidateQueries({ queryKey: ['wallet-groups'] });
    },
    onError: () => toast.error('Failed to create group'),
  });

  useEffect(() => {
    const lenis = getLenis();
    if (groupOpen) {
      lenis?.stop();
      if (groupOverlayRef.current && groupPanelRef.current) {
        animateModalEnter(groupOverlayRef.current, groupPanelRef.current);
      }
    } else {
      lenis?.start();
    }
    return () => lenis?.start();
  }, [groupOpen]);

  function closeGroupModal(): void {
    if (!groupOverlayRef.current || !groupPanelRef.current) {
      setGroupOpen(false);
      return;
    }
    animateModalExit(groupOverlayRef.current, groupPanelRef.current, () => setGroupOpen(false));
  }

  return (
    <PageWrapper
      title="Wallets"
      actions={
        <div className="flex gap-2">
          <Button type="button" className="bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]" onClick={() => setImportOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Import Wallet
          </Button>
          <Button type="button" variant="outline" onClick={() => setGroupOpen(true)}>
            Create Group
          </Button>
        </div>
      }
    >
      <div ref={pageRef} className="space-y-4">
      <ImportWalletDialog open={importOpen} onClose={() => setImportOpen(false)} />

      {groupOpen && wallets && (
        <div ref={groupOverlayRef} data-gsap className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card ref={groupPanelRef} data-gsap className="w-full max-w-md space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <div className="font-semibold text-[var(--text-primary)]">Create Group</div>
            <Input placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <div
              data-lenis-prevent-wheel
              className="max-h-48 space-y-1 overflow-auto text-xs text-[var(--text-secondary)]"
            >
              {wallets.map((w) => (
                <label key={w.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(w.id)}
                    onChange={(e) => {
                      setSelected((prev) =>
                        e.target.checked ? [...prev, w.id] : prev.filter((x) => x !== w.id)
                      );
                    }}
                  />
                  <span className="font-mono">{w.address.slice(0, 10)}…</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => createGroup.mutate()}>
                Create
              </Button>
              <Button type="button" variant="outline" onClick={closeGroupModal}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {walletsLoading ? (
        <Card data-animate className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-0">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {[1, 2, 3, 4].map((k) => (
                <tr key={k} className="border-t border-[var(--border-subtle)]">
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <td key={c} className="px-4 py-3">
                      <div className="skeleton h-4 rounded" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (wallets?.length ?? 0) > 0 ? (
        <>
          <div data-animate className="mb-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="text-xs text-[var(--text-secondary)]">Total Wallets</div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">{wallets?.length ?? 0}</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="text-xs text-[var(--text-secondary)]">Wallets with Active Bots</div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {wallets?.filter((w) => w.activeBotCount > 0).length ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="text-xs text-[var(--text-secondary)]">Total BNB Balance</div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {(wallets ?? []).reduce((sum, w) => sum + (Number(w.nativeBalance) || 0), 0).toFixed(4)}
              </div>
            </div>
          </div>

          <Card data-animate className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-0">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--text-secondary)]">
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">BNB</th>
                  <th className="px-4 py-3">Daily USD</th>
                  <th className="px-4 py-3">Active Bots</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {wallets?.map((w) => {
                  const bal = Number(w.nativeBalance) || 0;
                  return (
                    <tr key={w.id} className="border-t border-[var(--border-subtle)]">
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{w.label}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                        {w.address.slice(0, 8)}…{w.address.slice(-6)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[var(--text-primary)]">{w.nativeBalance}</div>
                        {bal === 0 && (
                          <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                            Low gas
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">${w.dailySpentNotional}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-depth)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                          {w.activeBotCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="rounded-md border border-[var(--border)] p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-depth)]"
                          aria-label="Open wallet actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <Card data-animate className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-10 text-center">
          <EmptyState
            icon={Wallet}
            title="No Wallets Imported"
            description="Import a private key wallet to power bot trading and monitor balances."
            action={
              <Button
                type="button"
                className="mt-5 bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
                onClick={() => setImportOpen(true)}
              >
                <Plus className="mr-1 h-4 w-4" />
                Import Your First Wallet
              </Button>
            }
          />
        </Card>
      )}
      </div>
    </PageWrapper>
  );
}
