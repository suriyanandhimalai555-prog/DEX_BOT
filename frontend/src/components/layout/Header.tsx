import { useLocation } from 'react-router-dom';
import { ConnectWalletButton } from './ConnectWalletButton';
import { ThemeToggle } from '../ui/ThemeToggle';

const titleByPath: Array<{ match: RegExp; title: string }> = [
  { match: /^\/$/, title: 'Dashboard' },
  { match: /^\/bots(\/|$)/, title: 'Bot Manager' },
  { match: /^\/wallets(\/|$)/, title: 'Wallet Manager' },
  { match: /^\/analytics(\/|$)/, title: 'Analytics' },
  { match: /^\/settings(\/|$)/, title: 'Settings' },
];

function pageTitle(pathname: string): string {
  for (const e of titleByPath) {
    if (e.match.test(pathname)) return e.title;
  }
  return 'Dashboard';
}

export function Header(): JSX.Element {
  const { pathname } = useLocation();
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-6">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">{pageTitle(pathname)}</h1>
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--brand-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-dark)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
          BSC Mainnet
        </div>
        <ThemeToggle className="gap-2" />
        <ConnectWalletButton />
      </div>
    </header>
  );
}

