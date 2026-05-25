import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

class BnbPriceService {
  private currentPriceUSD: number;
  private lastFetchAt: Date | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private onPriceUpdated: (() => void) | null = null;

  constructor() {
    const { BNB_PRICE_FALLBACK_USD } = getEnv();
    this.currentPriceUSD = BNB_PRICE_FALLBACK_USD;
  }

  setOnPriceUpdated(cb: () => void): void {
    this.onPriceUpdated = cb;
  }

  async fetchPrice(): Promise<number> {
    try {
      const url =
        'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd';
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { binancecoin?: { usd?: number } };
      const price = data?.binancecoin?.usd;
      if (typeof price === 'number' && price > 0) {
        this.currentPriceUSD = price;
        this.lastFetchAt = new Date();
        logger.info(`[BnbPrice] $${price.toFixed(2)} USD`);
        this.onPriceUpdated?.();
      }
      return this.currentPriceUSD;
    } catch (err) {
      logger.warn(`[BnbPrice] Fetch failed, using cached $${this.currentPriceUSD}`);
      return this.currentPriceUSD;
    }
  }

  getCurrentPrice(): number {
    return this.currentPriceUSD;
  }

  usdToBnb(usd: number): number {
    if (this.currentPriceUSD <= 0) return 0;
    return usd / this.currentPriceUSD;
  }

  bnbToUsd(bnb: number): number {
    return bnb * this.currentPriceUSD;
  }

  startPolling(): void {
    const { BNB_PRICE_POLL_INTERVAL_MS } = getEnv();
    void this.fetchPrice();
    this.intervalHandle = setInterval(() => {
      void this.fetchPrice();
    }, BNB_PRICE_POLL_INTERVAL_MS);
    logger.info(`[BnbPrice] Polling started (${BNB_PRICE_POLL_INTERVAL_MS}ms)`);
  }

  stopPolling(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  getStatus(): {
    currentPriceUSD: number;
    lastFetchAt: string | null;
    oneDollarInBNB: string;
  } {
    return {
      currentPriceUSD: this.currentPriceUSD,
      lastFetchAt: this.lastFetchAt?.toISOString() ?? null,
      oneDollarInBNB: this.usdToBnb(1).toFixed(6),
    };
  }
}

export const bnbPriceService = new BnbPriceService();
