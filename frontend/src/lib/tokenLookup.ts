import { Contract, JsonRpcProvider, formatUnits, getAddress, isAddress } from 'ethers';
import type { TokenHolding } from '../store/walletStore';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
] as const;

function getReadProvider(): JsonRpcProvider {
  const rpcUrl =
    import.meta.env.VITE_ALCHEMY_BSC_URL?.trim() || 'https://bsc-dataseed.binance.org';
  return new JsonRpcProvider(rpcUrl);
}

export function normalizeAddress(addr: string): string {
  return addr.toLowerCase().trim();
}

/** Full 42-char hex address (checksum not required). */
export function isAddressSearch(query: string): boolean {
  const q = query.trim();
  return q.startsWith('0x') && q.length === 42 && isAddress(q);
}

export async function lookupTokenByAddress(
  address: string,
  walletAddress: string
): Promise<TokenHolding | null> {
  const trimmed = address.trim();
  if (!isAddressSearch(trimmed) || !isAddress(walletAddress)) {
    return null;
  }

  let checksum: string;
  try {
    checksum = getAddress(trimmed);
  } catch {
    return null;
  }

  const provider = getReadProvider();
  const contract = new Contract(checksum, ERC20_ABI, provider);

  try {
    const [name, symbol, decimals, balance] = await Promise.all([
      contract.name() as Promise<string>,
      contract.symbol() as Promise<string>,
      contract.decimals() as Promise<number>,
      contract.balanceOf(walletAddress) as Promise<bigint>,
    ]);

    const dec = Number(decimals);
    if (!Number.isFinite(dec) || dec < 0) return null;

    const balanceRaw = balance.toString();
    const humanBalance = formatUnits(balance, dec);
    const displayBalance = Number.parseFloat(humanBalance);

    return {
      address: checksum,
      name: String(name),
      symbol: String(symbol),
      decimals: dec,
      balance: Number.isFinite(displayBalance) ? displayBalance.toFixed(6) : humanBalance,
      balanceRaw,
    };
  } catch (error) {
    console.error('[lookupTokenByAddress] Failed:', error);
    return null;
  }
}
