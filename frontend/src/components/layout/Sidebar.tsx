import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { LayoutDashboard, Bot, Wallet, BarChart3, Settings } from 'lucide-react';
import { animateNavIndicator } from '../../lib/animations';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/bots', label: 'Bots', icon: Bot },
  { to: '/wallets', label: 'Wallets', icon: Wallet },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar(): JSX.Element {
  const { pathname } = useLocation();
  const indicatorRef = useRef<HTMLDivElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  useEffect(() => {
    const matched = links.find((l) => (l.to === '/' ? pathname === '/' : pathname.startsWith(l.to)));
    const activeEl = matched ? navRefs.current.get(matched.to) : null;
    const indicator = indicatorRef.current;
    const nav = navContainerRef.current;
    if (!activeEl || !indicator || !nav) return;

    const parentRect = nav.getBoundingClientRect();
    const itemRect = activeEl.getBoundingClientRect();
    animateNavIndicator(indicator, itemRect.top - parentRect.top);
  }, [pathname]);

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />
          <div className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">DEX Bot</div>
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">BSC Automation Platform</div>
      </div>

      <nav ref={navContainerRef} className="relative mt-6 flex flex-1 flex-col gap-1 px-3">
        <div
          ref={indicatorRef}
          data-gsap
          className="pointer-events-none absolute left-3 right-3 top-0 h-[42px] rounded-lg bg-[var(--brand-bg)]"
        />
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            ref={(el) => {
              if (el) navRefs.current.set(to, el);
            }}
            className={({ isActive }) =>
              cn(
                'nav-link relative z-10 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                isActive
                  ? 'font-medium text-[var(--brand-dark)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-depth)] hover:text-[var(--text-primary)]'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] px-5 py-4 text-xs text-[var(--text-muted)]">v1.0 · BSC Mainnet</div>
    </aside>
  );
}
