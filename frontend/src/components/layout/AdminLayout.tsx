import { AdminSidebar } from './AdminSidebar';
import { PanelShell } from './PanelShell';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import * as adminApi from '../../api/adminApi';

export function AdminLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const { data: stats } = useQuery({
    queryKey: ['admin-stats-header'],
    queryFn: adminApi.getPlatformStats,
    refetchInterval: 60_000,
  });

  return (
    <PanelShell
      sidebar={<AdminSidebar />}
      headerBorderClass="border-[var(--admin-border)]"
      headerLeft={
        <div className="text-xs text-[var(--text-muted)]">
          {stats
            ? `${stats.activeTraders} active traders · ${stats.activeBots} bots · ${stats.pendingRequests} pending requests`
            : 'Platform overview'}
        </div>
      }
      headerExtras={
        <span className="rounded bg-[var(--admin-bg)] px-2 py-1 text-xs font-medium text-[var(--admin)]">
          {user?.displayName} · ADMIN
        </span>
      }
      onLogout={() => void logout()}
    />
  );
}
