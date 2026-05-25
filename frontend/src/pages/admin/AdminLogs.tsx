import { useQuery } from '@tanstack/react-query';
import * as adminApi from '../../api/adminApi';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/card';

export function AdminLogs(): JSX.Element {
  const { data } = useQuery({ queryKey: ['admin-logs'], queryFn: adminApi.getAdminLogs });
  const logs = data as {
    audit?: { entries: Array<{ action: string; details?: string; createdAt: string; userId?: string }> };
    recentFailedTransactions?: Array<{ walletAddress: string; failureCode?: string; createdAt: string }>;
  };

  return (
    <PageWrapper title="Platform logs">
      <Card className="mb-4">
        <div className="mb-2 font-medium">Audit log</div>
        <ul className="max-h-96 space-y-2 overflow-auto text-sm">
          {logs?.audit?.entries.map((e, i) => (
            <li key={i} className="border-b border-[var(--border-subtle)] pb-2">
              <span className="font-mono text-xs text-[var(--admin)]">{e.action}</span>
              <span className="ml-2 text-xs text-[var(--text-muted)]">
                {new Date(e.createdAt).toLocaleString()}
              </span>
              {e.details && <div className="text-xs text-[var(--text-secondary)]">{e.details}</div>}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <div className="mb-2 font-medium">Recent failed transactions</div>
        <ul className="text-sm">
          {logs?.recentFailedTransactions?.map((t, i) => (
            <li key={i} className="py-1 text-[var(--text-secondary)]">
              {t.walletAddress?.slice(0, 10)}… · {t.failureCode} · {new Date(t.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </Card>
    </PageWrapper>
  );
}
