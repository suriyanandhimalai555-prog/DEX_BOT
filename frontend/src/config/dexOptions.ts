/**
 * Frontend mirror of the backend DEX registry.
 * Extend this list when the bot supports a new DEX or router version.
 */

export type DexId = 'pancakeswap' | 'uniswap';
export type DexVersion = 'v2' | 'v3';

export interface DexOption {
  dex: DexId;
  version: DexVersion;
  /** Label shown in dropdowns and detail views. */
  label: string;
  title?: string;
}

export const DEX_OPTIONS: ReadonlyArray<DexOption> = [
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

/**
 * Returns the human-readable label for a dex + dexVersion pair.
 * Falls back gracefully for unknown combinations.
 */
export function getDexLabel(dex: string, dexVersion: string): string {
  const found = DEX_OPTIONS.find((o) => o.dex === dex && o.version === dexVersion);
  if (found) return found.label;
  const dexName = dex === 'uniswap' ? 'Uniswap' : 'PancakeSwap';
  return `${dexName} ${dexVersion.toUpperCase()}`;
}

/** Other routers to suggest when the current DEX has no pool for the pair. */
export function getAlternateDexLabels(dex: DexId, dexVersion: DexVersion): string[] {
  return DEX_OPTIONS.filter((o) => o.dex !== dex || o.version !== dexVersion).map((o) => o.label);
}
