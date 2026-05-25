import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as adminApi from '../../api/adminApi';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { RequestCard } from '../../components/admin/RequestCard';
import type { LimitRequest } from '../../api/types';

export function AdminTraderDetail(): JSX.Element {
  const { id } = useParams();
  const qc = useQueryClient();
  const [limitUsd, setLimitUsd] = useState('');

  const { data } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => adminApi.getAdminUser(id!),
    enabled: Boolean(id),
  });

  const detail = data as {
    user?: { displayName: string; email: string; role: string; isActive: boolean; tradeLimitUSD: number; tradeLimitBNB: number };
    limitRequests?: Array<{
      id: string;
      status: LimitRequest['status'];
      requestedUSD: number;
      currentUSD: number;
      reason: string;
      createdAt: string;
      adminNote?: string;
    }>;
    stats?: { totalTx: number; confirmedTx: number };
  };

  const override = useMutation({
    mutationFn: () => adminApi.overrideUserLimit(id!, Number(limitUsd)),
    onSuccess: async () => {
      toast.success('Limit updated');
      await qc.invalidateQueries({ queryKey: ['admin-user', id] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async () => {
      if (detail?.user?.isActive) await adminApi.deactivateUser(id!);
      else await adminApi.activateUser(id!);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-user', id] });
    },
  });

  if (!detail?.user) {
    return <PageWrapper title="Trader">Loading…</PageWrapper>;
  }

  const u = detail.user;

  return (
    <PageWrapper title={u.displayName}>
      <Card className="mb-4">
        <div className="text-sm text-[var(--text-muted)]">{u.email}</div>
        <div className="mt-2">
          Limit: ${u.tradeLimitUSD.toFixed(2)} = {u.tradeLimitBNB.toFixed(6)} BNB
        </div>
        <div className="mt-2 text-sm">
          Trades: {detail.stats?.confirmedTx ?? 0} confirmed / {detail.stats?.totalTx ?? 0} total
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" onClick={() => toggleActive.mutate()}>
            {u.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </Card>
      <Card className="mb-4">
        <div className="mb-2 font-medium">Override limit (USD)</div>
        <div className="flex gap-2">
          <Input type="number" value={limitUsd} onChange={(e) => setLimitUsd(e.target.value)} />
          <Button type="button" onClick={() => override.mutate()} disabled={!limitUsd}>
            Set limit
          </Button>
        </div>
      </Card>
      <h2 className="mb-2 text-sm font-medium">Limit requests</h2>
      <div className="space-y-3">
        {detail.limitRequests?.map((r) => (
          <RequestCard
            key={r.id}
            request={{
              ...r,
              userId: id!,
              updatedAt: r.createdAt,
              userDisplayName: u.displayName,
              userEmail: u.email,
            } satisfies LimitRequest}
          />
        ))}
      </div>
    </PageWrapper>
  );
}
