import { loadEnv } from '../config/env.js';
loadEnv();

import { formatEther } from 'ethers';
import { connectDb } from '../config/db.js';
import { getJsonRpcProvider } from '../config/chain.js';
import { Transaction } from '../models/Transaction.js';
import {
  emitTxConfirmed,
  emitTxFailed,
} from '../socket/txStream.js';
import { logger } from '../utils/logger.js';

await connectDb();

const provider = getJsonRpcProvider();

async function pollOnce(): Promise<void> {
  const txs = await Transaction.find({
    status: 'submitted',
    txHash: { $exists: true, $ne: '' },
  }).limit(100);

  for (const tx of txs) {
    if (!tx.txHash) continue;
    try {
      const receipt = await provider.getTransactionReceipt(tx.txHash);
      if (!receipt) continue;

      const gasPrice =
        receipt.gasPrice ??
        ('effectiveGasPrice' in receipt && receipt.effectiveGasPrice
          ? receipt.effectiveGasPrice
          : 0n);
      const gasSpent =
        receipt.gasUsed && gasPrice ? receipt.gasUsed * gasPrice : undefined;

      if (receipt.status === 1) {
        tx.status = 'confirmed';
        tx.confirmedAt = new Date();
        if (gasSpent !== undefined) {
          tx.gasSpentBNB = formatEther(gasSpent);
        }
        await tx.save();
        emitTxConfirmed(String(tx.createdBy), tx);
      } else if (receipt.status === 0) {
        tx.status = 'failed';
        tx.failureCode = 'UNKNOWN_REVERT';
        tx.failureReason = 'Transaction reverted on-chain';
        tx.confirmedAt = new Date();
        await tx.save();
        emitTxFailed(String(tx.createdBy), tx, 'UNKNOWN_REVERT');
      }
    } catch (err) {
      logger.error(`Confirmation poll error tx=${tx.txHash} ${err}`);
    }
  }
}

setInterval(() => {
  pollOnce().catch((e) => logger.error(String(e)));
}, 5000);

logger.info('Confirmation worker polling every 5s');
