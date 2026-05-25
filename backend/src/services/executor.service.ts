import { Contract, MaxUint256, getAddress, parseUnits } from 'ethers';
import mongoose from 'mongoose';
import { getEnv } from '../config/env.js';
import { getJsonRpcProvider } from '../config/chain.js';
import { resolveRouterAddress } from '../config/dex.js';
import type { IBot } from '../models/Bot.js';
import type { FailureCode, ITransaction } from '../models/Transaction.js';
import { Transaction } from '../models/Transaction.js';
import type { IWallet } from '../models/Wallet.js';
import { logger } from '../utils/logger.js';
import { buildSwapTx, getQuote, type SwapParams } from './pancake.adapter.js';
import { createSignerFromWallet } from './signer.service.js';
import type { ExecutionIntent } from './strategy.service.js';
import {
  emitTxFailed,
  emitTxSubmitted,
} from '../socket/txStream.js';
import { capWeiToUserLimit } from '../utils/tradeLimit.js';

const ERC20_FULL_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const PRICE_IMPACT_MAX_BPS = 1500;

function classifyFailure(err: unknown): FailureCode {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('insufficient funds') || lower.includes('insufficient balance')) {
    return 'INSUFFICIENT_BALANCE';
  }
  if (lower.includes('slippage') || lower.includes('too little received')) {
    return 'SLIPPAGE_EXCEEDED';
  }
  if (lower.includes('nonce')) return 'NONCE_CONFLICT';
  if (lower.includes('estimate gas') || lower.includes('gas')) return 'GAS_ESTIMATION_FAILED';
  if (lower.includes('network') || lower.includes('timeout') || lower.includes('503')) {
    return 'RPC_UNAVAILABLE';
  }
  if (lower.includes('transfer amount exceeds balance')) return 'INSUFFICIENT_BALANCE';
  return 'UNKNOWN_REVERT';
}

export interface ExecuteIntentParams {
  bot: IBot;
  wallet: IWallet;
  intent: ExecutionIntent;
  botRunId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | string;
  /** The wallet owner's per-user encryption key (hex). Must match the key used at wallet import. */
  encryptionKey: string;
}

async function persistFailed(
  partial: Partial<ITransaction> & Pick<ITransaction, 'botId' | 'walletId' | 'createdBy'>
): Promise<ITransaction> {
  const doc = await Transaction.create({
    ...partial,
    status: 'failed',
  });
  return doc;
}

export async function executeIntent(
  params: ExecuteIntentParams
): Promise<{
  txHash?: string;
  failureCode?: FailureCode;
  wasLimitCapped?: boolean;
}> {
  const { bot, wallet, intent, botRunId, userId, encryptionKey } = params;
  const provider = getJsonRpcProvider();
  const env = getEnv();
  const wbnb = getAddress(env.WBNB_ADDRESS);

  let tokenIn: string;
  let tokenOut: string;
  try {
    const base = getAddress(bot.baseToken);
    const quote = getAddress(bot.quoteToken);
    if (intent.side === 'buy') {
      tokenIn = quote;
      tokenOut = base;
    } else {
      tokenIn = base;
      tokenOut = quote;
    }
  } catch {
    const code: FailureCode = 'TOKEN_RESTRICTED';
    const doc = await persistFailed({
      botId: bot._id,
      botRunId,
      walletId: wallet._id,
      walletAddress: wallet.address,
      chain: 'bsc',
      dex: bot.dex,
      dexVersion: bot.dexVersion,
      side: intent.side,
      inputToken: bot.baseToken,
      outputToken: bot.quoteToken,
      inputAmount: intent.amountIn.toString(),
      failureCode: code,
      failureReason: 'Invalid token addresses',
      createdBy: new mongoose.Types.ObjectId(String(userId)),
    });
    emitTxFailed(String(userId), doc, code);
    return { failureCode: code };
  }

  const signer = createSignerFromWallet(wallet, encryptionKey);
  const routerAddr = resolveRouterAddress(bot.dex, bot.dexVersion);

  logger.info({
    message: 'executeIntent_start',
    botId: String(bot._id),
    walletId: String(wallet._id),
    dex: bot.dex,
    dexVersion: bot.dexVersion,
    routerAddress: routerAddr,
    step: 'signer_ready',
  });

  const tokenInLc = tokenIn.toLowerCase();
  const isNativePath = tokenInLc === wbnb.toLowerCase();
  const isQuoteSpend = intent.side === 'buy' && isNativePath;

  const capResult = await capWeiToUserLimit(String(userId), intent.amountIn, isQuoteSpend);
  const effectiveAmountIn = capResult.amountWei;
  if (capResult.wasCapped) {
    logger.warn(
      `[Executor] Trade capped bot=${String(bot._id)} requested=${capResult.requestedBNB?.toFixed(6)} capped=${capResult.cappedToBNB?.toFixed(6)} limitUSD=${capResult.limitUSD}`
    );
  }

  try {
    if (isNativePath) {
      const bal = await provider.getBalance(signer.address);
      if (bal < effectiveAmountIn) {
        throw Object.assign(new Error('insufficient native balance'), {
          code: 'INSUFFICIENT_BALANCE',
        });
      }
    } else {
      const erc20 = new Contract(tokenIn, ERC20_FULL_ABI, provider);
      const bal = await erc20.balanceOf(signer.address);
      if (bal < effectiveAmountIn) {
        const code: FailureCode = 'INSUFFICIENT_BALANCE';
        const doc = await persistFailed({
          botId: bot._id,
          botRunId,
          walletId: wallet._id,
          walletAddress: wallet.address,
          chain: 'bsc',
          dex: bot.dex,
          dexVersion: bot.dexVersion,
          side: intent.side,
          inputToken: tokenIn,
          outputToken: tokenOut,
          inputAmount: effectiveAmountIn.toString(),
          failureCode: code,
          failureReason: 'Token balance too low',
          createdBy: new mongoose.Types.ObjectId(String(userId)),
        });
        emitTxFailed(String(userId), doc, code);
        return { failureCode: code };
      }
    }

    const swapParams: SwapParams = {
      dex: bot.dex,
      dexVersion: bot.dexVersion,
      side: intent.side,
      tokenIn,
      tokenOut,
      amountIn: effectiveAmountIn,
      slippageBps: intent.slippageBps,
      recipient: signer.address,
      deadlineSeconds: 120,
    };

    let quoteResult;
    try {
      quoteResult = await getQuote(swapParams, provider);
    } catch (e) {
      const code: FailureCode = 'ROUTE_UNAVAILABLE';
      const doc = await persistFailed({
        botId: bot._id,
        botRunId,
        walletId: wallet._id,
        walletAddress: wallet.address,
        chain: 'bsc',
        dex: bot.dex,
        dexVersion: bot.dexVersion,
        side: intent.side,
        inputToken: tokenIn,
        outputToken: tokenOut,
        inputAmount: effectiveAmountIn.toString(),
        failureCode: code,
        failureReason: e instanceof Error ? e.message : String(e),
        createdBy: new mongoose.Types.ObjectId(String(userId)),
      });
      emitTxFailed(String(userId), doc, code);
      return { failureCode: code };
    }

    if (quoteResult.priceImpactBps > PRICE_IMPACT_MAX_BPS) {
      const code: FailureCode = 'SLIPPAGE_EXCEEDED';
      const doc = await persistFailed({
        botId: bot._id,
        botRunId,
        walletId: wallet._id,
        walletAddress: wallet.address,
        chain: 'bsc',
        dex: bot.dex,
        dexVersion: bot.dexVersion,
        side: intent.side,
        inputToken: tokenIn,
        outputToken: tokenOut,
        inputAmount: effectiveAmountIn.toString(),
        failureCode: code,
        failureReason: `Price impact ${quoteResult.priceImpactBps} bps`,
        createdBy: new mongoose.Types.ObjectId(String(userId)),
      });
      emitTxFailed(String(userId), doc, code);
      return { failureCode: code };
    }

    if (!isNativePath) {
      const erc20Rw = new Contract(tokenIn, ERC20_FULL_ABI, signer);
      const allowance = await erc20Rw.allowance(signer.address, routerAddr);
      if (allowance < effectiveAmountIn) {
        logger.info({
          message: 'executeIntent_approve',
          botId: String(bot._id),
          walletId: String(wallet._id),
          step: 'approve_token',
        });
        const approveTx = await erc20Rw.approve(routerAddr, MaxUint256);
        await approveTx.wait();
      }
    }

    const baseTx = await buildSwapTx(swapParams, provider);

    const swapTo = typeof baseTx.to === 'string' ? baseTx.to : '';
    if (swapTo.toLowerCase() !== routerAddr.toLowerCase()) {
      logger.warn({
        message: 'executeIntent_router_mismatch',
        botId: String(bot._id),
        expectedRouter: routerAddr,
        swapTo,
        dex: bot.dex,
        dexVersion: bot.dexVersion,
      });
    }

    logger.info({
      message: 'executeIntent_swap',
      botId: String(bot._id),
      walletId: String(wallet._id),
      dex: bot.dex,
      dexVersion: bot.dexVersion,
      routerAddress: routerAddr,
      swapTo,
      tokenIn,
      tokenOut,
    });

    logger.info({
      message: 'executeIntent_estimateGas',
      botId: String(bot._id),
      walletId: String(wallet._id),
      step: 'estimate_gas',
    });

    const estimated = await signer.estimateGas({
      to: baseTx.to,
      data: baseTx.data,
      value: baseTx.value ?? 0n,
      from: signer.address,
    });
    const gasLimit = (estimated * 12n) / 10n;

    const feeData = await provider.getFeeData();
    let gasPriceWei = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;
    if (intent.gasPolicy.mode === 'fixed' && intent.gasPolicy.maxGweiOverride != null) {
      gasPriceWei = parseUnits(String(intent.gasPolicy.maxGweiOverride), 'gwei');
    }

    const nativeBal = await provider.getBalance(signer.address);
    const gasCostApprox = gasLimit * gasPriceWei;
    if (nativeBal < gasCostApprox + (isNativePath ? effectiveAmountIn : 0n)) {
      const code: FailureCode = 'INSUFFICIENT_BALANCE';
      const doc = await persistFailed({
        botId: bot._id,
        botRunId,
        walletId: wallet._id,
        walletAddress: wallet.address,
        chain: 'bsc',
        dex: bot.dex,
        dexVersion: bot.dexVersion,
        side: intent.side,
        inputToken: tokenIn,
        outputToken: tokenOut,
        inputAmount: effectiveAmountIn.toString(),
        failureCode: code,
        failureReason: 'Not enough BNB for gas',
        createdBy: new mongoose.Types.ObjectId(String(userId)),
      });
      emitTxFailed(String(userId), doc, code);
      return { failureCode: code };
    }

    const txReq: Parameters<typeof signer.sendTransaction>[0] = {
      to: baseTx.to,
      data: baseTx.data,
      value: baseTx.value ?? 0n,
      gasLimit,
    };
    if (feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
      txReq.maxFeePerGas = feeData.maxFeePerGas;
      txReq.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    } else {
      txReq.gasPrice = gasPriceWei;
    }

    const txResponse = await signer.sendTransaction(txReq);

    const quotedPrice =
      effectiveAmountIn > 0n
        ? (Number(quoteResult.amountOut) / Number(effectiveAmountIn)).toFixed(18)
        : '0';

    const submitted = await Transaction.create({
      botId: bot._id,
      botRunId,
      walletId: wallet._id,
      walletAddress: wallet.address,
      chain: 'bsc',
      dex: bot.dex,
      dexVersion: bot.dexVersion,
      side: intent.side,
      inputToken: tokenIn,
      outputToken: tokenOut,
      inputAmount: effectiveAmountIn.toString(),
      status: 'submitted',
      wasLimitCapped: capResult.wasCapped,
      ...(capResult.wasCapped && capResult.cappedToBNB != null
        ? {
            limitCapDetails: {
              requestedBNB: String(capResult.requestedBNB ?? 0),
              cappedToBNB: String(capResult.cappedToBNB),
              limitUSD: capResult.limitUSD ?? 0,
              bnbPriceAtTrade: capResult.bnbPriceAtTrade ?? 0,
            },
          }
        : {}),
      txHash: txResponse.hash,
      submittedAt: new Date(),
      quotedPrice,
      createdBy: new mongoose.Types.ObjectId(String(userId)),
    });

    emitTxSubmitted(String(userId), submitted);

    logger.info({
      message: 'executeIntent_submitted',
      botId: String(bot._id),
      walletId: String(wallet._id),
      step: 'tx_submitted',
      txHash: txResponse.hash,
    });

    return { txHash: txResponse.hash, wasLimitCapped: capResult.wasCapped };
  } catch (err) {
    const code = classifyFailure(err);
    logger.error(
      `executeIntent error bot=${String(bot._id)} wallet=${String(wallet._id)} ${err}`
    );
    const doc = await persistFailed({
      botId: bot._id,
      botRunId,
      walletId: wallet._id,
      walletAddress: wallet.address,
      chain: 'bsc',
      dex: bot.dex,
      dexVersion: bot.dexVersion,
      side: intent.side,
      inputToken: tokenIn,
      outputToken: tokenOut,
      inputAmount: effectiveAmountIn.toString(),
      failureCode: code,
      failureReason: err instanceof Error ? err.message : String(err),
      createdBy: new mongoose.Types.ObjectId(String(userId)),
    });
    emitTxFailed(String(userId), doc, code);
    return { failureCode: code };
  }
}
