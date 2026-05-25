import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import * as adminApi from '../../api/adminApi';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/card';
import { RequestCard } from '../../components/admin/RequestCard';

export function AdminDashboard(): JSX.Element {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminApi.getPlatformStats,
  });
  const { data: requests } = useQuery({
    queryKey: ['admin-requests-pending'],
    queryFn: () => adminApi.getAdminRequests('pending'),
  });
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.getAdminUsers,
  });

  return (
    <PageWrapper title="Admin dashboard">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <div className="text-xs text-[var(--text-muted)]">Traders</div>
          <div className="text-2xl font-semibold">{stats?.totalTraders ?? '—'}</div>
          <div className="text-xs text-[var(--text-secondary)]">
            {stats?.activeTraders ?? 0} active
          </div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--text-muted)]">Active bots</div>
          <div className="text-2xl font-semibold">{stats?.activeBots ?? '—'}</div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--text-muted)]">Volume (24h)</div>
          <div className="text-2xl font-semibold">{stats?.totalVolumeBNB ?? '—'} BNB</div>
          <div className="text-xs">≈ ${stats?.totalVolumeUSD ?? '—'}</div>
        </Card>
        <Card className={stats && stats.pendingRequests > 0 ? 'border-red-300' : ''}>
          <div className="text-xs text-[var(--text-muted)]">Pending requests</div>
          <div className="text-2xl font-semibold text-red-600">{stats?.pendingRequests ?? 0}</div>
          <Link to="/admin/requests" className="text-xs text-[var(--admin)]">
            Review now →
          </Link>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-medium">Pending limit requests</h2>
          <div className="space-y-3">
            {requests?.requests.slice(0, 5).map((r) => (
              <RequestCard key={r.id} request={r} compact />
            ))}
            {!requests?.requests.length && (
              <p className="text-sm text-[var(--text-muted)]">No pending requests</p>
            )}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-medium">Traders</h2>
          <Card>
            <ul className="divide-y divide-[var(--border)] text-sm">
              {users?.users.slice(0, 8).map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2">
                  <Link to={`/admin/traders/${u.id}`} className="text-[var(--admin)] hover:underline">
                    {u.displayName}
                  </Link>
                  <span className="text-xs text-[var(--text-muted)]">
                    ${u.tradeLimitUSD.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
