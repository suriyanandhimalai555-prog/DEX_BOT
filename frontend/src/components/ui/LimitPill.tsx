import { Link } from 'react-router-dom';
import type { AuthUser } from '../../api/types';

export function LimitPill({ user }: { user: AuthUser }): JSX.Element {
  const isDefault = user.tradeLimitUSD <= 1.01;
  return (
    <Link
      to="/trader/limit"
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        isDefault
          ? 'border-amber-500/35 bg-[var(--warning-bg)] text-[var(--warning)]'
          : 'border-[var(--brand)]/40 bg-[var(--brand-bg)] text-[var(--brand-dark)]'
      }`}
    >
      ${user.tradeLimitUSD.toFixed(2)} · {user.tradeLimitBNB.toFixed(6)} BNB
    </Link>
  );
}
