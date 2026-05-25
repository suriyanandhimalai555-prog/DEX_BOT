import type { Request, Response } from 'express';
import axios from 'axios';
import { ethers } from 'ethers';
import { getEnv } from '../config/env.js';
import { AppError } from '../utils/errors.js';

type RpcResult<T> = { result?: T; error?: { message?: string } };

type TokenBalanceRow = {
  contractAddress: string;
  tokenBalance?: string;
  error?: unknown;
};

type HoldingPayload = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceRaw: string;
  usdValue?: string;
  logoUrl?: string | null;
  priceUsd?: string;
};

async function alchemyRpc<T>(
  url: string,
  method: string,
  params: unknown[]
): Promise<T> {
  const { data } = await axios.post<RpcResult<T>>(
    url,
    { jsonrpc: '2.0', method, params, id: 1 },
    { headers: { 'Content-Type': 'application/json' }, timeout: 30_000 }
  );
  if (data.error) {
    throw new Error(data.error.message ?? 'Alchemy RPC error');
  }
  if (data.result === undefined) {
    throw new Error('Alchemy RPC returned empty result');
  }
  return data.result;
}

const ZERO_HEX =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

const BN_LOGO =
  'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png';

async function enrichUsdUsd(holdings: HoldingPayload[]): Promise<void> {
  try {
    const bnbIx = holdings.findIndex((h) => h.address === 'NATIVE');
    if (bnbIx !== -1) {
      try {
        const { data } = await axios.get<Record<string, { usd?: number }>>(
          'https://api.coingecko.com/api/v3/simple/price',
          { params: { ids: 'binancecoin', vs_currencies: 'usd' }, timeout: 8_000 }
        );
        const px = data.binancecoin?.usd;
        if (typeof px === 'number' && Number.isFinite(px)) {
          const bal = Number.parseFloat(holdings[bnbIx].balance);
          if (!Number.isNaN(bal)) {
            const usd = bal * px;
            holdings[bnbIx].priceUsd = px.toFixed(6);
            holdings[bnbIx].usdValue = usd >= 0.01 ? usd.toFixed(2) : usd.toFixed(6);
          }
        }
      } catch {
        /* optional */
      }
    }

    const erc20 = holdings
      .filter((h) => h.address !== 'NATIVE')
      .slice(0, 25);

    const addrs = erc20.map((h) => h.address.toLowerCase()).join(',');
    if (!addrs.length) return;

    const { data } = await axios.get<Record<string, { usd?: number }>>(
      'https://api.coingecko.com/api/v3/simple/token_price/binance-smart-chain',
      { params: { contract_addresses: addrs, vs_currencies: 'usd' }, timeout: 10_000 }
    );

    const byLc = new Map(holdings.map((h) => [h.address.toLowerCase(), h]));
    for (const [contractLc, vals] of Object.entries(data)) {
      const px = vals?.usd;
      if (typeof px !== 'number' || !Number.isFinite(px)) continue;
      const h = byLc.get(contractLc);
      if (!h) continue;
      const bal = Number.parseFloat(h.balance);
      if (Number.isNaN(bal)) continue;
      const usd = bal * px;
      h.priceUsd = px.toFixed(8);
      h.usdValue = usd >= 0.01 ? usd.toFixed(2) : usd.toFixed(6);
    }
  } catch {
    /* optional — balances still returned */
  }
}

export async function getHoldings(req: Request, res: Response): Promise<void> {
  const raw = req.params.walletAddress;
  if (!raw || !ethers.isAddress(raw)) {
    throw new AppError('INVALID_ADDRESS', 'Invalid EVM address', 400);
  }

  const checksumAddress = ethers.getAddress(raw);
  const { ALCHEMY_BSC_MAINNET_URL: alchemyUrl } = getEnv();

  type BalancesResult = { tokenBalances?: TokenBalanceRow[] };

  let balancesResult: BalancesResult;
  try {
    balancesResult = await alchemyRpc<BalancesResult>(
      alchemyUrl,
      'alchemy_getTokenBalances',
      [checksumAddress, 'erc20']
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Alchemy request failed';
    throw new AppError('INTERNAL_ERROR', `Token balances unavailable: ${msg}`, 502);
  }

  const rawBalances = (balancesResult.tokenBalances ?? []).filter(
    (t) =>
      !t.error &&
      t.tokenBalance &&
      t.tokenBalance !== ZERO_HEX
  );

  const bnbBalanceWei = await alchemyRpc<string>(
    alchemyUrl,
    'eth_getBalance',
    [checksumAddress, 'latest']
  );
  const bnbWei = BigInt(bnbBalanceWei);
  const bnbBalance = ethers.formatEther(bnbWei);

  const holdings: HoldingPayload[] = [
    {
      address: 'NATIVE',
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18,
      balance: Number.parseFloat(bnbBalance).toFixed(6),
      balanceRaw: bnbWei.toString(),
      logoUrl: BN_LOGO,
    },
  ];

  const metadataList = await Promise.allSettled(
    rawBalances.map((token) =>
      alchemyRpc<{
        decimals?: number | null;
        symbol?: string | null;
        name?: string | null;
        logo?: string | null;
      }>(alchemyUrl, 'alchemy_getTokenMetadata', [token.contractAddress])
    )
  );

  rawBalances.forEach((token, i) => {
    const metaResult = metadataList[i];
    if (metaResult.status !== 'fulfilled') return;
    const meta = metaResult.value;
    const decimals =
      typeof meta.decimals === 'number' && Number.isFinite(meta.decimals)
        ? meta.decimals
        : null;
    if (decimals === null || decimals < 0) return;

    let rawBal: bigint;
    try {
      rawBal = BigInt(token.tokenBalance!);
    } catch {
      return;
    }
    if (rawBal === 0n) return;

    const humanBalance = ethers.formatUnits(rawBal, decimals);
    const displayBalance = Number.parseFloat(humanBalance);
    if (!Number.isFinite(displayBalance) || displayBalance < 0.000001) return;

    let addr: string;
    try {
      addr = ethers.getAddress(token.contractAddress);
    } catch {
      return;
    }

    holdings.push({
      address: addr,
      symbol: meta.symbol ?? 'UNKNOWN',
      name: meta.name ?? 'Unknown Token',
      decimals,
      balance: displayBalance.toFixed(6),
      balanceRaw: rawBal.toString(),
      logoUrl: meta.logo ?? null,
    });
  });

  await enrichUsdUsd(holdings);

  res.json({ holdings });
}
