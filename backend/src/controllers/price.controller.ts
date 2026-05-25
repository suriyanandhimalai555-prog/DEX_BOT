import type { Request, Response } from 'express';
import { Contract, solidityPacked, type Provider } from 'ethers';
import { getJsonRpcProvider } from '../config/chain.js';
import { resolveV2RouterAddress, resolveV3QuoterAddress } from '../config/dex.js';
import type { PriceTokenQuery } from '../schemas/priceTokenQuery.js';

const PANCAKE_V3_QUOTER = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

const V2_ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)',
] as const;

const V3_QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
  'function quoteExactInput(bytes path, uint256 amountIn) external returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)',
] as const;

const ERC20_ABI = ['function decimals() view returns (uint8)'] as const;

const V3_FEE_TIERS = [100, 500, 2500, 10_000] as const;

export type TokenPriceResponse = {
  listed: boolean;
  priceInQuote: string | null;
  priceInUsd: string | null;
  quoteName: string;
  poolFee?: number | null;
  liquidityWarning: boolean;
  route: string[];
  error?: string;
};

const WBNB_LC = WBNB.toLowerCase();
const USDT_LC = USDT.toLowerCase();
const USDC_LC = USDC.toLowerCase();

function addressLabel(addr: string, quoteWasNative: boolean): string {
  const lc = addr.toLowerCase();
  if (lc === WBNB_LC) return quoteWasNative ? 'BNB' : 'WBNB';
  if (lc === USDT_LC) return 'USDT';
  if (lc === USDC_LC) return 'USDC';
  return 'QUOTE';
}

function quoteDisplayName(quoteAddr: string, quoteParamWasNative: boolean): string {
  const lc = quoteAddr.toLowerCase();
  if (lc === WBNB_LC) return quoteParamWasNative ? 'BNB' : 'WBNB';
  const known: Record<string, string> = {
    [USDT_LC]: 'USDT',
    [USDC_LC]: 'USDC',
    ['0x2170Ed0880ac9A755fd29B2688956BD959F933F8'.toLowerCase()]: 'ETH',
    ['0x570A5D26f7765Ecb712C0924E4De545B89fD43dF'.toLowerCase()]: 'SOL',
    ['0x85EAC5Ac2F758618dFa09bDbe0cf174e7d574D5B'.toLowerCase()]: 'TRX',
  };
  return known[lc] ?? 'QUOTE';
}

async function readDecimals(provider: Provider, token: string): Promise<number> {
  try {
    const c = new Contract(token, ERC20_ABI, provider);
    const d = await c.decimals();
    return Number(d);
  } catch {
    return 18;
  }
}

async function tryV2Amounts(
  router: Contract,
  amountIn: bigint,
  path: string[]
): Promise<bigint[] | null> {
  try {
    return (await router.getAmountsOut(amountIn, path)) as bigint[];
  } catch {
    return null;
  }
}

function trimTrailingZeros(s: string): string {
  const t = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return t === '' || t === '-0' ? '0' : t;
}

/** Enough precision for API consumers / UI formatters (avoids rounding micro-cap USD to 0). */
function formatPriceForApi(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null;
  if (n === 0) return '0';
  const abs = Math.abs(n);
  let s: string;
  if (abs < 1e-6) {
    s = trimTrailingZeros(n.toFixed(24));
  } else if (abs < 1) {
    s = trimTrailingZeros(n.toFixed(18));
  } else {
    s = trimTrailingZeros(n.toPrecision(14));
  }
  if (s.includes('e') || s.includes('E')) {
    s = trimTrailingZeros(n.toFixed(24));
  }
  return s;
}

async function v2QuoteToUsd(
  router: Contract,
  provider: Provider,
  quoteAddr: string,
  quoteDecimals: number,
  priceInQuoteFloat: number
): Promise<number | null> {
  const qLc = quoteAddr.toLowerCase();
  if (qLc === USDT_LC || qLc === USDC_LC) {
    return priceInQuoteFloat;
  }
  const quoteAmountIn = BigInt(10) ** BigInt(quoteDecimals);
  try {
    let usdAmounts: bigint[];
    if (qLc === WBNB_LC) {
      usdAmounts = (await router.getAmountsOut(quoteAmountIn, [WBNB, USDT])) as bigint[];
    } else {
      try {
        usdAmounts = (await router.getAmountsOut(quoteAmountIn, [quoteAddr, USDT])) as bigint[];
      } catch {
        usdAmounts = (await router.getAmountsOut(quoteAmountIn, [quoteAddr, WBNB, USDT])) as bigint[];
      }
    }
    const usdtDecimals = await readDecimals(provider, USDT);
    const out = usdAmounts[usdAmounts.length - 1]!;
    const quoteUsd = Number(out) / 10 ** usdtDecimals;
    return priceInQuoteFloat * quoteUsd;
  } catch {
    return null;
  }
}

async function v2LiquidityWarning(
  router: Contract,
  path: string[],
  baseDecimals: number,
  quoteDecimals: number
): Promise<boolean> {
  const one = BigInt(10) ** BigInt(baseDecimals);
  const large = one * 100n;
  try {
    const smallAmounts = (await router.getAmountsOut(one, path)) as bigint[];
    const largeAmounts = (await router.getAmountsOut(large, path)) as bigint[];
    const outSmall = smallAmounts[smallAmounts.length - 1]!;
    const outLarge = largeAmounts[largeAmounts.length - 1]!;
    const spot = Number(outSmall) / 10 ** quoteDecimals;
    const avg = Number(outLarge) / 100 / 10 ** quoteDecimals;
    if (spot <= 0) return true;
    const impact = Math.abs(avg - spot) / spot;
    return impact > 0.05;
  } catch {
    return true;
  }
}

type V2Result = {
  amountOut: bigint;
  path: string[];
  route: string[];
};

async function resolveV2(
  router: Contract,
  base: string,
  quote: string,
  amountIn: bigint,
  quoteWasNative: boolean
): Promise<V2Result | null> {
  const quoteLc = quote.toLowerCase();

  let amounts = await tryV2Amounts(router, amountIn, [base, quote]);
  if (amounts) {
    return {
      amountOut: amounts[1]!,
      path: [base, quote],
      route: ['BASE', addressLabel(quote, quoteWasNative)],
    };
  }

  if (quoteLc !== WBNB_LC) {
    amounts = await tryV2Amounts(router, amountIn, [base, WBNB, quote]);
    if (amounts) {
      return {
        amountOut: amounts[2]!,
        path: [base, WBNB, quote],
        route: ['BASE', 'WBNB', addressLabel(quote, quoteWasNative)],
      };
    }
  }

  return null;
}

type V3Win = {
  amountOut: bigint;
  poolFee: number | null;
  route: string[];
  /** Encoded path for quoteExactInput (single or multi hop) */
  pathBytes: `0x${string}`;
};

async function resolveV3(
  quoter: Contract,
  base: string,
  quote: string,
  amountIn: bigint,
  quoteWasNative: boolean
): Promise<V3Win | null> {
  const quoteLc = quote.toLowerCase();

  for (const fee of V3_FEE_TIERS) {
    try {
      const result = (await quoter.quoteExactInputSingle.staticCall({
        tokenIn: base,
        tokenOut: quote,
        amountIn,
        fee,
        sqrtPriceLimitX96: 0n,
      })) as [bigint, bigint, number, bigint];
      const pathBytes = solidityPacked(
        ['address', 'uint24', 'address'],
        [base, fee, quote]
      ) as `0x${string}`;
      return {
        amountOut: result[0],
        poolFee: fee,
        route: ['BASE', addressLabel(quote, quoteWasNative)],
        pathBytes,
      };
    } catch {
      continue;
    }
  }

  if (quoteLc === WBNB_LC) {
    return null;
  }

  for (const fee0 of V3_FEE_TIERS) {
    for (const fee1 of V3_FEE_TIERS) {
      const pathBytes = solidityPacked(
        ['address', 'uint24', 'address', 'uint24', 'address'],
        [base, fee0, WBNB, fee1, quote]
      ) as `0x${string}`;
      try {
        const result = (await quoter.quoteExactInput.staticCall(pathBytes, amountIn)) as [
          bigint,
          bigint[],
          number[],
          bigint,
        ];
        return {
          amountOut: result[0],
          poolFee: fee0,
          route: ['BASE', 'WBNB', addressLabel(quote, quoteWasNative)],
          pathBytes,
        };
      } catch {
        continue;
      }
    }
  }

  return null;
}

async function v3LiquidityWarning(
  quoter: Contract,
  pathBytes: `0x${string}`,
  baseDecimals: number,
  quoteDecimals: number
): Promise<boolean> {
  const one = BigInt(10) ** BigInt(baseDecimals);
  const large = one * 100n;
  try {
    const rS = (await quoter.quoteExactInput.staticCall(pathBytes, one)) as [bigint, bigint[], number[], bigint];
    const rL = (await quoter.quoteExactInput.staticCall(pathBytes, large)) as [bigint, bigint[], number[], bigint];
    const outSmall = rS[0];
    const outLarge = rL[0];
    const spot = Number(outSmall) / 10 ** quoteDecimals;
    const avg = Number(outLarge) / 100 / 10 ** quoteDecimals;
    if (spot <= 0) return true;
    const impact = Math.abs(avg - spot) / spot;
    return impact > 0.05;
  } catch {
    return true;
  }
}

export async function getTokenPrice(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as PriceTokenQuery;

  const quoteWasNative = q.quoteToken === 'NATIVE';
  const quoteAddrResolved = quoteWasNative ? WBNB : q.quoteToken;
  const baseAddress = q.baseToken;
  const dexVersion = q.dexVersion;
  const dex = q.dex ?? 'pancakeswap';
  const provider = getJsonRpcProvider();
  const v2RouterAddr = dexVersion === 'v2' ? resolveV2RouterAddress(dex) : resolveV2RouterAddress('pancakeswap');
  const v3QuoterAddr = dex === 'pancakeswap' ? PANCAKE_V3_QUOTER : resolveV3QuoterAddress('pancakeswap');
  const router = new Contract(v2RouterAddr, V2_ROUTER_ABI, provider);
  const quoter = new Contract(v3QuoterAddr, V3_QUOTER_ABI, provider);

  let tokenDecimals =
    q.baseDecimals !== undefined && Number.isFinite(q.baseDecimals) ? q.baseDecimals : NaN;
  if (!Number.isFinite(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 36) {
    tokenDecimals = await readDecimals(provider, baseAddress);
  }

  const amountIn = BigInt(10) ** BigInt(tokenDecimals);
  const quoteDecimals = await readDecimals(provider, quoteAddrResolved);
  const quoteName = quoteDisplayName(quoteAddrResolved, quoteWasNative);

  const dexLabel = dex === 'uniswap' ? 'Uniswap V2' : 'PancakeSwap V2';
  const notListedV2 = (): TokenPriceResponse => ({
    listed: false,
    priceInQuote: null,
    priceInUsd: null,
    quoteName,
    poolFee: null,
    liquidityWarning: false,
    route: [],
    error: `This token has no liquidity pool on ${dexLabel} for this pair.`,
  });

  const notListedV3 = (): TokenPriceResponse => ({
    listed: false,
    priceInQuote: null,
    priceInUsd: null,
    quoteName,
    poolFee: null,
    liquidityWarning: false,
    route: [],
    error:
      'No liquidity pool found on PancakeSwap V3 for this pair at common fee tiers (0.01%, 0.05%, 0.25%, 1%). Try PancakeSwap V2.',
  });

  if (dexVersion === 'v2') {
    const v2 = await resolveV2(router, baseAddress, quoteAddrResolved, amountIn, quoteWasNative);
    if (!v2) {
      res.json(notListedV2());
      return;
    }

    const priceInQuoteFloat = Number(v2.amountOut) / 10 ** quoteDecimals;
    const priceInUsd = await v2QuoteToUsd(router, provider, quoteAddrResolved, quoteDecimals, priceInQuoteFloat);
    const liquidityWarning = await v2LiquidityWarning(router, v2.path, tokenDecimals, quoteDecimals);

    const body: TokenPriceResponse = {
      listed: true,
      priceInQuote: formatPriceForApi(priceInQuoteFloat),
      priceInUsd: formatPriceForApi(priceInUsd),
      quoteName,
      liquidityWarning,
      route: v2.route,
    };
    res.json(body);
    return;
  }

  const v3 = await resolveV3(quoter, baseAddress, quoteAddrResolved, amountIn, quoteWasNative);
  if (!v3) {
    res.json(notListedV3());
    return;
  }

  const priceInQuoteFloat = Number(v3.amountOut) / 10 ** quoteDecimals;
  let priceInUsd: number | null = null;
  const qLc = quoteAddrResolved.toLowerCase();
  if (qLc === USDT_LC || qLc === USDC_LC) {
    priceInUsd = priceInQuoteFloat;
  } else {
    priceInUsd = await v2QuoteToUsd(router, provider, quoteAddrResolved, quoteDecimals, priceInQuoteFloat);
  }

  const liquidityWarning = await v3LiquidityWarning(quoter, v3.pathBytes, tokenDecimals, quoteDecimals);

  const body: TokenPriceResponse = {
    listed: true,
    priceInQuote: formatPriceForApi(priceInQuoteFloat),
    priceInUsd: formatPriceForApi(priceInUsd),
    quoteName,
    poolFee: v3.poolFee,
    liquidityWarning,
    route: v3.route,
  };
  res.json(body);
}
