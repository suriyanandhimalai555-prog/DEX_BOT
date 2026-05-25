import { TraderSidebar } from './TraderSidebar';
import { PanelShell } from './PanelShell';
import { LimitPill } from '../ui/LimitPill';
import { useAuth } from '../../context/AuthContext';

export function TraderLayout(): JSX.Element {
  const { user, logout } = useAuth();

  return (
    <PanelShell
      sidebar={<TraderSidebar />}
      headerLeft={
        <div className="text-sm text-[var(--text-secondary)]">
          {user?.displayName} · {user?.email}
        </div>
      }
      headerExtras={user ? <LimitPill user={user} /> : null}
      onLogout={() => void logout()}
    />
  );
}
