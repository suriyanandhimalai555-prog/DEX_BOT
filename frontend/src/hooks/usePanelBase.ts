import { useLocation } from 'react-router-dom';

/** Returns `/trader` when inside trader panel routes, else `` for legacy paths. */
export function usePanelBase(): string {
  const { pathname } = useLocation();
  return pathname.startsWith('/trader') ? '/trader' : '';
}
