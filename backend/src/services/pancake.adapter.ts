import { Contract, type TransactionRequest, JsonRpcProvider, Interface } from 'ethers';
import { getEnv } from '../config/env.js';
import {
  type DexId,
  resolveV2RouterAddress,
  resolveV3QuoterAddress,
  resolveV3RouterAddress,
} from '../config/dex.js';

export interface QuoteResult {
  amountOut: bigint;
  priceImpactBps: number;
  path: string[];
}

export interface SwapParams {
  dex: DexId;
  dexVersion: 'v2' | 'v3';
  side: 'buy' | 'sell';
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  slippageBps: number;
  recipient: string;
  deadlineSeconds?: number;
  v3FeeTier?: 100 | 500 | 2500 | 10000;
}

const V2_ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external',
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external',
];

const V3_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
];

const V3_QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

const ERC20_ABI = ['function decimals() view returns (uint8)'];

function deadlineTs(seconds = 120): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

function minOut(amountOut: bigint, slippageBps: number): bigint {
  return (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
}

/** Single-hop path only (direct pair). */
function pathPair(tokenIn: string, tokenOut: string): string[] {
  return [tokenIn, tokenOut];
}

async function estimatePriceImpactBps(
  provider: JsonRpcProvider,
  params: SwapParams,
  amountOutFull: bigint,
  dexVersion: 'v2' | 'v3'
): Promise<number> {
  if (params.amountIn <= 100n) return 0;
  const smallIn = params.amountIn / 100n;
  let amountOutSmall: bigint;
  if (dexVersion === 'v2') {
    const router = new Contract(resolveV2RouterAddress(params.dex), V2_ROUTER_ABI, provider);
    const path = pathPair(params.tokenIn, params.tokenOut);
    const amounts = await router.getAmountsOut(smallIn, path);
    amountOutSmall = amounts[amounts.length - 1] as bigint;
  } else {
    const fee = params.v3FeeTier ?? 2500;
    const quoter = new Contract(resolveV3QuoterAddress(params.dex), V3_QUOTER_ABI, provider);
    const [outSmall] = await quoter.quoteExactInputSingle.staticCall(
      params.tokenIn,
      params.tokenOut,
      fee,
      smallIn,
      0n
    );
    amountOutSmall = outSmall as bigint;
  }
  const marginalSmall = (amountOutSmall * params.amountIn) / smallIn;
  if (marginalSmall === 0n) return 0;
  const diff =
    marginalSmall > amountOutFull ? marginalSmall - amountOutFull : amountOutFull - marginalSmall;
  const bps = Number((diff * 10_000n) / marginalSmall);
  return Math.min(10_000, Math.max(0, bps));
}

export async function getQuote(
  params: SwapParams,
  provider: JsonRpcProvider
): Promise<QuoteResult> {
  const path = pathPair(params.tokenIn, params.tokenOut);
  if (params.dexVersion === 'v2') {
    const router = new Contract(resolveV2RouterAddress(params.dex), V2_ROUTER_ABI, provider);
    const amounts = await router.getAmountsOut(params.amountIn, path);
    const amountOut = amounts[amounts.length - 1] as bigint;
    const priceImpactBps = await estimatePriceImpactBps(provider, params, amountOut, 'v2');
    return { amountOut, priceImpactBps, path };
  }
  const fee = params.v3FeeTier ?? 2500;
  const quoter = new Contract(resolveV3QuoterAddress(params.dex), V3_QUOTER_ABI, provider);
  const [amountOut] = await quoter.quoteExactInputSingle.staticCall(
    params.tokenIn,
    params.tokenOut,
    fee,
    params.amountIn,
    0n
  );
  const out = amountOut as bigint;
  const priceImpactBps = await estimatePriceImpactBps(provider, params, out, 'v3');
  return { amountOut: out, priceImpactBps, path };
}

export async function buildSwapTx(
  params: SwapParams,
  provider: JsonRpcProvider
): Promise<TransactionRequest> {
  const env = getEnv();
  const quote = await getQuote(params, provider);
  const amountOutMin = minOut(quote.amountOut, params.slippageBps);
  const dl = deadlineTs(params.deadlineSeconds ?? 120);
  const wbnb = env.WBNB_ADDRESS.toLowerCase();

  if (params.dexVersion === 'v2') {
    const routerAddr = resolveV2RouterAddress(params.dex);
    const iface = new Interface(V2_ROUTER_ABI);
    const path = quote.path;

    const tokenInLc = params.tokenIn.toLowerCase();
    const tokenOutLc = params.tokenOut.toLowerCase();

    if (tokenInLc === wbnb) {
      const data = iface.encodeFunctionData(
        'swapExactETHForTokensSupportingFeeOnTransferTokens',
        [amountOutMin, path, params.recipient, dl]
      );
      return {
        to: routerAddr,
        data,
        value: params.amountIn,
        chainId: BigInt(getEnv().BSC_CHAIN_ID),
      };
    }
    if (tokenOutLc === wbnb) {
      const data = iface.encodeFunctionData(
        'swapExactTokensForETHSupportingFeeOnTransferTokens',
        [params.amountIn, amountOutMin, path, params.recipient, dl]
      );
      return {
        to: routerAddr,
        data,
        chainId: BigInt(getEnv().BSC_CHAIN_ID),
      };
    }
    const data = iface.encodeFunctionData(
      'swapExactTokensForTokensSupportingFeeOnTransferTokens',
      [params.amountIn, amountOutMin, path, params.recipient, dl]
      );
    return {
      to: routerAddr,
      data,
      chainId: BigInt(getEnv().BSC_CHAIN_ID),
    };
  }

  const fee = params.v3FeeTier ?? 2500;
  const routerAddr = resolveV3RouterAddress(params.dex);
  const iface = new Interface(V3_ROUTER_ABI);
  const paramsTuple = {
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    fee,
    recipient: params.recipient,
    deadline: BigInt(dl),
    amountIn: params.amountIn,
    amountOutMinimum: amountOutMin,
    sqrtPriceLimitX96: 0n,
  };
  const tokenInLc = params.tokenIn.toLowerCase();
  const data = iface.encodeFunctionData('exactInputSingle', [paramsTuple]);
  const tx: TransactionRequest = {
    to: routerAddr,
    data,
    chainId: BigInt(getEnv().BSC_CHAIN_ID),
  };
  if (tokenInLc === wbnb) {
    tx.value = params.amountIn;
  }
  return tx;
}

export { ERC20_ABI };
