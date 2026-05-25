import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export interface PriceCheckResult {
  listed: boolean;
  priceInQuote: string | null;
  priceInUsd: string | null;
  quoteName: string;
  poolFee?: number | null;
  liquidityWarning: boolean;
  route: string[];
  error?: string;
}

interface UsePriceCheckOptions {
  baseToken: string;
  /** Checksummed quote address or `NATIVE` for BNB. */
  quoteTokenParam: string;
  dex?: 'pancakeswap' | 'uniswap';
  dexVersion: 'v2' | 'v3';
  baseDecimals?: number;
  enabled: boolean;
}

export function usePriceCheck({
  baseToken,
  quoteTokenParam,
  dex = 'pancakeswap',
  dexVersion,
  baseDecimals = 18,
  enabled,
}: UsePriceCheckOptions) {
  const [data, setData] = useState<PriceCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchPrice = useCallback(async () => {
    if (!enabled || !baseToken || !quoteTokenParam) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setLoading(true);
    setError(null);

    try {
      const res = await api.get<PriceCheckResult>('/price/token', {
        params: {
          baseToken,
          quoteToken: quoteTokenParam,
          dex,
          dexVersion,
          baseDecimals,
        },
        signal,
      });
      setData(res.data);
    } catch (e: unknown) {
      if (axios.isCancel(e) || (e as { code?: string })?.code === 'ERR_CANCELED') return;
      setError('Failed to fetch price. Check your connection.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [baseToken, quoteTokenParam, dex, dexVersion, baseDecimals, enabled]);

  useEffect(() => {
    setData(null);
    setError(null);
  }, [dex, dexVersion]);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchPrice();
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, fetchPrice]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      void fetchPrice();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [enabled, fetchPrice]);

  return { data, loading, error, refetch: fetchPrice };
}
