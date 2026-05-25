import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Bot,
  Wallet,
  BarChart3,
  Settings,
  Shield,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import * as traderApi from '../../api/traderApi';

const links = [
  { to: '/trader/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/trader/bots', label: 'Bots', icon: Bot },
  { to: '/trader/wallets', label: 'Wallets', icon: Wallet },
  { to: '/trader/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/trader/limit', label: 'Trade limit', icon: Shield },
  { to: '/trader/settings', label: 'Settings', icon: Settings },
];

export function TraderSidebar(): JSX.Element {
  const { user } = useAuth();
  const { data: requests } = useQuery({
    queryKey: ['my-limit-requests'],
    queryFn: () => traderApi.getMyLimitRequests(),
  });
  const pending = requests?.requests.some((r) => r.status === 'pending');

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />
          <div className="text-lg font-semibold text-[var(--text-primary)]">DEX Bot</div>
        </div>
        <span className="mt-1 inline-block rounded bg-[var(--brand-bg)] px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--brand-dark)]">
          Trader
        </span>
      </div>
      <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'nav-link flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm',
                isActive
                  ? 'bg-[var(--brand-bg)] font-medium text-[var(--brand-dark)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-depth)]'
              )
            }
          >
            <span className="flex items-center gap-3">
              <Icon className="h-4 w-4" />
              {label}
            </span>
            {to === '/trader/limit' && pending && (
              <span className="rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[10px] text-[var(--warning)]">
                PENDING
              </span>
            )}
            {to === '/trader/limit' &&
              !pending &&
              user &&
              user.tradeLimitUSD <= 1.01 && (
                <span className="rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[10px] text-[var(--warning)]">
                  $1
                </span>
              )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
