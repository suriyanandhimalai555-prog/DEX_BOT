import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { WalletConnectSync } from '../wallets/WalletConnectSync';
import { WrongNetworkBanner } from './WrongNetworkBanner';
import { ConnectWalletButton } from './ConnectWalletButton';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Button } from '../ui/button';

export function PanelShell({
  sidebar,
  headerLeft,
  headerExtras,
  headerBorderClass = 'border-[var(--border)]',
  onLogout,
}: {
  sidebar: ReactNode;
  headerLeft: ReactNode;
  headerExtras?: ReactNode;
  headerBorderClass?: string;
  onLogout: () => void;
}): JSX.Element {
  return (
    <div className="flex h-screen bg-[var(--bg-canvas)]">
      <WalletConnectSync />
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={`flex shrink-0 items-center justify-between border-b bg-[var(--bg-surface)] px-6 py-3 ${headerBorderClass}`}
        >
          <div className="min-w-0">{headerLeft}</div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--brand-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-dark)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
              BSC Mainnet
            </div>
            <ThemeToggle className="gap-2 text-xs" />
            <ConnectWalletButton />
            {headerExtras}
            <Button type="button" variant="outline" className="text-xs" onClick={onLogout}>
              Log out
            </Button>
          </div>
        </header>
        <WrongNetworkBanner />
        <main
          data-lenis-prevent-wheel
          className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] p-6"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
