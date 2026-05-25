/**
 * Manual smoke test: `npx tsx src/scripts/quote-smoke.ts`
 * Requires valid .env with Alchemy URL and Pancake addresses.
 */
import { loadEnv } from '../config/env.js';

loadEnv();

import { getEnv } from '../config/env.js';
import { getJsonRpcProvider } from '../config/chain.js';
import { getQuote } from '../services/pancake.adapter.js';

const BUSD_BSC = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';

async function main(): Promise<void> {
  const provider = getJsonRpcProvider();
  const env = getEnv();
  const amountIn = 10n ** 15n; // 0.001 WBNB
  const quote = await getQuote(
    {
      dex: 'pancakeswap',
      dexVersion: 'v2',
      side: 'buy',
      tokenIn: env.WBNB_ADDRESS,
      tokenOut: BUSD_BSC,
      amountIn,
      slippageBps: 300,
      recipient: env.WBNB_ADDRESS,
    },
    provider
  );
  console.log('Quote OK:', {
    amountOut: quote.amountOut.toString(),
    priceImpactBps: quote.priceImpactBps,
    path: quote.path,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
