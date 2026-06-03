import type { TokenHolding } from '../store/walletStore';
import { normalizeAddress } from './tokenLookup';

const STORAGE_KEY = 'dex-bot-custom-tokens';

export function getCustomTokens(): TokenHolding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is TokenHolding =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as TokenHolding).address === 'string' &&
        (t as TokenHolding).address.startsWith('0x')
    );
  } catch {
    return [];
  }
}

export function addCustomToken(token: TokenHolding): void {
  const existing = getCustomTokens();
  const lc = normalizeAddress(token.address);
  if (existing.some((t) => normalizeAddress(t.address) === lc)) return;
  existing.push(token);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}
