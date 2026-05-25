/** Trim trailing zeros after decimal; keep "0" if empty. */
function trimTrailingZeros(s: string): string {
  const t = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return t === '' || t === '-0' ? '0' : t;
}

/**
 * Formats a token price for display. Never uses scientific notation in `display` or `exact`.
 */
export function formatTokenPrice(
  price: string | null,
  _symbol: string = ''
): {
  display: string;
  exact: string;
  isMicro: boolean;
  isZero: boolean;
} {
  if (!price || price.trim() === '') {
    return { display: '—', exact: '', isMicro: false, isZero: true };
  }

  const n = Number.parseFloat(price);
  if (!Number.isFinite(n) || n === 0) {
    return { display: '0', exact: '0', isMicro: false, isZero: true };
  }

  if (Math.abs(n) < 1e-18) {
    return { display: '≈ 0', exact: trimTrailingZeros(n.toFixed(24)), isMicro: true, isZero: true };
  }

  const exact = trimTrailingZeros(n.toFixed(24));
  const isMicro = n > 0 && n < 0.000001;

  if (isMicro) {
    return { display: exact, exact, isMicro: true, isZero: false };
  }

  if (n < 0.0001) {
    return { display: trimTrailingZeros(n.toFixed(8)), exact, isMicro: false, isZero: false };
  }
  if (n < 0.01) {
    return { display: trimTrailingZeros(n.toFixed(6)), exact, isMicro: false, isZero: false };
  }
  if (n < 1) {
    return { display: trimTrailingZeros(n.toFixed(4)), exact, isMicro: false, isZero: false };
  }
  if (n < 1000) {
    return { display: trimTrailingZeros(n.toFixed(4)), exact, isMicro: false, isZero: false };
  }
  if (n < 1e6) {
    return {
      display: n.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      exact,
      isMicro: false,
      isZero: false,
    };
  }
  return {
    display: n.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    exact,
    isMicro: false,
    isZero: false,
  };
}

/**
 * Formats USD for display. No scientific notation; sub-cent values use extra decimals or a floor label.
 */
export function formatUsdPrice(price: string | null): {
  display: string;
  isMicro: boolean;
  isZero: boolean;
} {
  if (price == null || price.trim() === '') {
    return { display: '—', isMicro: false, isZero: true };
  }

  const n = Number.parseFloat(price);
  if (!Number.isFinite(n)) {
    return { display: '—', isMicro: false, isZero: true };
  }
  if (n === 0) {
    return { display: '$0.00', isMicro: false, isZero: true };
  }

  if (n > 0 && n < 1e-10) {
    return { display: '< $0.0000000001', isMicro: true, isZero: false };
  }
  if (n > 0 && n < 0.000001) {
    return { display: `$${trimTrailingZeros(n.toFixed(14))}`, isMicro: true, isZero: false };
  }
  if (n < 0.001) {
    return { display: `$${trimTrailingZeros(n.toFixed(8))}`, isMicro: true, isZero: false };
  }
  if (n < 0.01) {
    return { display: `$${trimTrailingZeros(n.toFixed(6))}`, isMicro: false, isZero: false };
  }
  if (n < 1) {
    return { display: `$${trimTrailingZeros(n.toFixed(4))}`, isMicro: false, isZero: false };
  }
  if (n < 10000) {
    return { display: `$${n.toFixed(2)}`, isMicro: false, isZero: false };
  }
  return {
    display: `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    isMicro: false,
    isZero: false,
  };
}

export type PriceStatus = 'not_listed' | 'low_liquidity' | 'micro_price' | 'healthy';

export function classifyPriceStatus(
  listed: boolean,
  liquidityWarning: boolean,
  priceInUsd: string | null,
  priceInQuote: string | null
): PriceStatus {
  if (!listed) return 'not_listed';
  if (liquidityWarning) return 'low_liquidity';

  const usd = priceInUsd != null && priceInUsd !== '' ? Number.parseFloat(priceInUsd) : NaN;
  if (Number.isFinite(usd) && usd > 0 && usd < 0.000001) {
    return 'micro_price';
  }

  const pq = formatTokenPrice(priceInQuote);
  if (pq.isMicro && !pq.isZero) {
    return 'micro_price';
  }

  return 'healthy';
}
