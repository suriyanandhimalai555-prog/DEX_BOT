/**
 * DEX Registry — single source of truth for all supported DEXes.
 * Add a new entry here to support a new router; nothing else needs changing.
 *
 * Supported on BSC today:
 *   pancakeswap  — PancakeSwap V2 + V3   (Uniswap V2 fork + Uniswap V3 fork)
 *   uniswap      — Uniswap V2 on BSC     (official Uniswap V2 deployment on BSC)
 */
import { getEnv } from './env.js';

export type DexId = 'pancakeswap' | 'uniswap';
export type DexVersion = 'v2' | 'v3';

export interface DexDefinition {
  id: DexId;
  /** Human-readable name shown in UI. */
  name: string;
  chain: 'bsc';
  /** Versions this DEX supports. */
  versions: DexVersion[];
  /**
   * IUniswapV2Router02-compatible router address.
   * Required when versions includes 'v2'.
   */
  v2Router?: string;
  /**
   * ISwapRouter-compatible router address (Uniswap V3 style).
   * Required when versions includes 'v3'.
   */
  v3Router?: string;
  /**
   * IQuoterV2-compatible quoter address.
   * Required when versions includes 'v3'.
   */
  v3Quoter?: string;
}

function buildRegistry(): Record<DexId, DexDefinition> {
  const env = getEnv();
  return {
    pancakeswap: {
      id: 'pancakeswap',
      name: 'PancakeSwap',
      chain: 'bsc',
      versions: ['v2', 'v3'],
      v2Router: env.PANCAKE_V2_ROUTER,
      v3Router: env.PANCAKE_V3_ROUTER,
      v3Quoter: env.PANCAKE_V3_QUOTER,
    },
    uniswap: {
      id: 'uniswap',
      name: 'Uniswap',
      chain: 'bsc',
      versions: ['v2'],
      v2Router: env.UNISWAP_V2_ROUTER ?? '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    },
  };
}

export function getDexDefinition(dex: DexId): DexDefinition {
  return buildRegistry()[dex];
}

/** Throws if this DEX has no V2 router configured. */
export function resolveV2RouterAddress(dex: DexId): string {
  const def = getDexDefinition(dex);
  if (!def.v2Router) {
    throw new Error(`DEX "${dex}" does not support V2 or no V2 router is configured`);
  }
  return def.v2Router;
}

/** Throws if this DEX has no V3 router configured. */
export function resolveV3RouterAddress(dex: DexId): string {
  const def = getDexDefinition(dex);
  if (!def.v3Router) {
    throw new Error(`DEX "${dex}" does not support V3 or no V3 router is configured`);
  }
  return def.v3Router;
}

/** Router used for swaps and ERC-20 approvals for this bot's DEX + version. */
export function resolveRouterAddress(dex: DexId, dexVersion: DexVersion): string {
  return dexVersion === 'v2' ? resolveV2RouterAddress(dex) : resolveV3RouterAddress(dex);
}

/** Throws if this DEX has no V3 quoter configured. */
export function resolveV3QuoterAddress(dex: DexId): string {
  const def = getDexDefinition(dex);
  if (!def.v3Quoter) {
    throw new Error(`DEX "${dex}" does not support V3 quoter or no V3 quoter is configured`);
  }
  return def.v3Quoter;
}

/** All DEX IDs (useful for validation / UI lists). */
export const ALL_DEX_IDS: DexId[] = ['pancakeswap', 'uniswap'];

/**
 * Ordered list of DEX + version combinations for UI dropdowns.
 * Add new rows here when listing on a new DEX or version.
 */
export const DEX_VERSION_OPTIONS: ReadonlyArray<{
  dex: DexId;
  version: DexVersion;
  label: string;
  title?: string;
}> = [
  {
    dex: 'pancakeswap',
    version: 'v2',
    label: 'PancakeSwap V2',
    title: 'PancakeSwap BSC — Uniswap V2-style router',
  },
  {
    dex: 'pancakeswap',
    version: 'v3',
    label: 'PancakeSwap V3',
    title: 'PancakeSwap BSC — V3 concentrated liquidity',
  },
  {
    dex: 'uniswap',
    version: 'v2',
    label: 'Uniswap V2',
    title: 'Uniswap V2 on BSC — official Uniswap deployment',
  },
];

/** Display label for API/UI (e.g. "PancakeSwap V2", "Uniswap V2"). */
export function getDexDisplayLabel(dex: DexId, dexVersion: DexVersion): string {
  const found = DEX_VERSION_OPTIONS.find((o) => o.dex === dex && o.version === dexVersion);
  if (found) return found.label;
  const def = getDexDefinition(dex);
  return `${def.name} ${dexVersion.toUpperCase()}`;
}
