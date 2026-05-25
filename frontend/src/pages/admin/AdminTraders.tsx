import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as adminApi from '../../api/adminApi';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/card';
export function AdminTraders(): JSX.Element {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const { data } = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.getAdminUsers });

  const users =
    data?.users.filter((u) => {
      if (filter === 'active') return u.isActive;
      if (filter === 'inactive') return !u.isActive;
      return true;
    }) ?? [];

  return (
    <PageWrapper title="Traders">
      <div className="mb-4 flex gap-2">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`rounded-lg px-3 py-1 text-sm ${filter === f ? 'bg-[var(--admin-bg)] text-[var(--admin)]' : 'text-[var(--text-muted)]'}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-muted)]">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Limit</th>
              <th className="p-2">Bots</th>
              <th className="p-2">Pending</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[var(--border)]">
                <td className="p-2">
                  <Link to={`/admin/traders/${u.id}`} className="text-[var(--admin)] hover:underline">
                    {u.displayName}
                  </Link>
                </td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">${u.tradeLimitUSD.toFixed(2)}</td>
                <td className="p-2">{u.activeBotCount}</td>
                <td className="p-2">{u.pendingRequestCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageWrapper>
  );
}
