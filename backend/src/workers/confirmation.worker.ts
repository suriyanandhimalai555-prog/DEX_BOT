import { loadEnv } from '../config/env.js';
loadEnv();

import { formatEther } from 'ethers';
import { connectDb } from '../config/db.js';
import { prisma } from '../config/prisma.js';
import { getJsonRpcProvider } from '../config/chain.js';
import { mapTransaction } from '../db/mappers.js';
import {
  emitTxConfirmed,
  emitTxFailed,
} from '../socket/txStream.js';
import { logger } from '../utils/logger.js';

await connectDb();

const provider = getJsonRpcProvider();

async function pollOnce(): Promise<void> {
  const txs = await prisma.transaction.findMany({
    where: {
      status: 'submitted',
      txHash: { not: null },
    },
    take: 100,
  });

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
        const updated = await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            status: 'confirmed',
            confirmedAt: new Date(),
            ...(gasSpent !== undefined ? { gasSpentBNB: formatEther(gasSpent) } : {}),
          },
        });
        emitTxConfirmed(updated.createdBy, mapTransaction(updated));
      } else if (receipt.status === 0) {
        const updated = await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            status: 'failed',
            failureCode: 'UNKNOWN_REVERT',
            failureReason: 'Transaction reverted on-chain',
            confirmedAt: new Date(),
          },
        });
        emitTxFailed(updated.createdBy, mapTransaction(updated), 'UNKNOWN_REVERT');
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
