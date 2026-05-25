import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Users,
  Bell,
  Bot,
  Terminal,
  Settings,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import * as adminApi from '../../api/adminApi';

const links = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/traders', label: 'Traders', icon: Users },
  { to: '/admin/requests', label: 'Requests', icon: Bell },
  { to: '/admin/bots', label: 'Bots', icon: Bot },
  { to: '/admin/logs', label: 'Logs', icon: Terminal },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar(): JSX.Element {
  const { data } = useQuery({
    queryKey: ['admin-pending-count'],
    queryFn: adminApi.getPendingCount,
    refetchInterval: 30_000,
  });
  const pending = data?.count ?? 0;

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="border-b border-[var(--admin-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--admin)]" />
          <div className="text-lg font-semibold text-[var(--text-primary)]">DEX Bot</div>
        </div>
        <span className="mt-1 inline-block rounded bg-[var(--admin-bg)] px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--admin)]">
          Admin panel
        </span>
      </div>
      <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin/dashboard'}
            className={({ isActive }) =>
              cn(
                'nav-link flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm',
                isActive
                  ? 'border-l-2 border-[var(--admin)] bg-[var(--admin-bg)] font-medium text-[var(--admin)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-depth)]'
              )
            }
          >
            <span className="flex items-center gap-3">
              <Icon className="h-4 w-4" />
              {label}
            </span>
            {to === '/admin/requests' && pending > 0 && (
              <span className="animate-pulse rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--danger)]">
                {pending}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
