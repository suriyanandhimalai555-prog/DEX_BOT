import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as adminApi from '../../api/adminApi';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { RequestCard } from '../../components/admin/RequestCard';

export function AdminRequests(): JSX.Element {
  const [tab, setTab] = useState<string | undefined>('pending');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-requests', tab],
    queryFn: () => adminApi.getAdminRequests(tab),
  });

  const requests = data?.requests ?? [];
  const emptyLabel =
    tab === 'pending'
      ? 'No pending limit requests.'
      : tab === 'approved'
        ? 'No approved requests.'
        : tab === 'rejected'
          ? 'No rejected requests.'
          : 'No limit requests yet.';

  return (
    <PageWrapper title="Limit requests">
      <p className="mb-4 text-sm text-[var(--text-secondary)]">
        Review trader requests to increase their per-trade and daily notional caps.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: 'pending', label: 'Pending' },
          { key: undefined, label: 'All' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
        ].map(({ key, label }) => (
          <button
            key={label}
            type="button"
            className={`rounded-lg border border-[var(--border)] px-3 py-1 text-sm ${
              tab === key
                ? 'bg-[var(--admin-bg)] font-medium text-[var(--admin)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-depth)]'
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className="text-sm text-[var(--text-muted)]">Loading requests…</p>
      )}
      {isError && (
        <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] p-4 text-sm">
          <p className="text-[var(--danger)]">Could not load requests.</p>
          <button
            type="button"
            className="mt-2 text-[var(--brand-dark)] underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">{emptyLabel}</p>
        </div>
      )}

      <div className="space-y-4">
        {requests.map((r) => (
          <RequestCard key={r.id} request={r} />
        ))}
      </div>
    </PageWrapper>
  );
}
