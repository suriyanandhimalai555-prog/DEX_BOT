/** @deprecated Legacy layout — use PanelShell via TraderLayout / AdminLayout. */
import { Outlet } from 'react-router-dom';
import { WalletConnectSync } from '../wallets/WalletConnectSync';
import { WrongNetworkBanner } from './WrongNetworkBanner';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout(): JSX.Element {
  return (
    <div className="flex h-screen bg-[var(--bg-canvas)]">
      <WalletConnectSync />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
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
