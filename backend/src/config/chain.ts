import { JsonRpcProvider } from 'ethers';
import { getEnv } from './env.js';

let provider: JsonRpcProvider | null = null;

export function getJsonRpcProvider(): JsonRpcProvider {
  if (!provider) {
    const { ALCHEMY_BSC_MAINNET_URL, BSC_CHAIN_ID } = getEnv();
    provider = new JsonRpcProvider(ALCHEMY_BSC_MAINNET_URL, {
      chainId: BSC_CHAIN_ID,
      name: 'bsc',
    });
  }
  return provider;
}
