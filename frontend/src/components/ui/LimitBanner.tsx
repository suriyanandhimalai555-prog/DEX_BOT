import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import * as traderApi from '../../api/traderApi';
import * as authApi from '../../api/authApi';

export function LimitBanner(): JSX.Element {
  const { user } = useAuth();
  const { data: requests } = useQuery({
    queryKey: ['my-limit-requests'],
    queryFn: () => traderApi.getMyLimitRequests(),
  });
  const { data: bnb } = useQuery({
    queryKey: ['bnb-price'],
    queryFn: authApi.getBnbPrice,
    refetchInterval: 60_000,
  });

  if (!user) return <></>;

  const pending = requests?.requests.find((r) => r.status === 'pending');
  const isDefault = user.tradeLimitUSD <= 1.01;

  let tone = 'border-[var(--info)] bg-[var(--info-bg)]';
  let title = 'Trade limit active';
  if (pending) {
    tone = 'border-[var(--info)]/40 bg-[var(--info-bg)]';
    title = 'Limit increase request pending';
  } else if (!isDefault) {
    tone = 'border-[var(--brand)]/40 bg-[var(--brand-bg)]';
    title = `Approved limit: $${user.tradeLimitUSD.toFixed(2)}`;
  } else {
    tone = 'border-amber-500/35 bg-[var(--warning-bg)]';
  }

  return (
    <div className={`mb-4 rounded-xl border p-4 ${tone}`}>
      <div className="font-medium text-[var(--text-primary)]">{title}</div>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Trades are capped at ${user.tradeLimitUSD.toFixed(2)} USD ({user.tradeLimitBNB.toFixed(6)}{' '}
        BNB)
        {bnb ? ` @ BNB $${bnb.currentPriceUSD.toFixed(2)}` : ''}.
      </p>
      {!pending && isDefault && (
        <Link to="/trader/limit" className="mt-2 inline-block text-sm font-medium text-[var(--brand-dark)]">
          Request limit increase →
        </Link>
      )}
    </div>
  );
}
