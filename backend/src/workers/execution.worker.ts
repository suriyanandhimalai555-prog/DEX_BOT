import { loadEnv } from '../config/env.js';
loadEnv();

import { pathToFileURL } from 'node:url';
import { Worker, type Job } from 'bullmq';
import { connectDb } from '../config/db.js';
import { prisma } from '../config/prisma.js';
import { isUuid } from '../utils/ids.js';
import { createBullmqConnection } from '../config/bullmqRedis.js';
import { QUEUE_NAMES } from '../config/queues.js';
import type { IBot } from '../models/Bot.js';
import type { IWallet } from '../models/Wallet.js';
import { mapBot, mapWallet } from '../db/mappers.js';
import { cancelBotExecution, scheduleNextRun } from '../services/scheduler.service.js';
import { executeIntent } from '../services/executor.service.js';
import { generateIntents } from '../services/strategy.service.js';
import { logger } from '../utils/logger.js';
import { emitBotError, emitBotLog, emitBotStatus } from '../socket/txStream.js';
import { sendTelegramAlert } from '../services/telegram.service.js';
import { getOrCreateUserEncryptionKey } from '../utils/userKey.js';
import { decryptPrivateKey, encryptPrivateKey } from '../utils/crypto.js';
import { getEnv } from '../config/env.js';

logger.info({ message: 'Execution worker module loaded' });

const QUEUE_NAME = QUEUE_NAMES.BOT_EXECUTION;
const WORKER_CONCURRENCY = 3;

let workerInstance: Worker<{ botId: string; triggeredAt: number }> | null = null;
let dbReady = false;

/**
 * Transparent migration: if a wallet was encrypted with the old global
 * ENCRYPTION_MASTER_KEY (from .env) and the per-user key can't decrypt it,
 * attempt decryption with the legacy key and silently re-encrypt under the
 * per-user key. Works for every user automatically — no manual intervention.
 */
async function autoMigrateWalletEncryption(
  wallet: IWallet,
  perUserKey: string
): Promise<IWallet> {
  try {
    decryptPrivateKey(wallet.encryptedPrivateKey, perUserKey);
    return wallet;
  } catch {
    // fall through to legacy key attempt
  }

  const { ENCRYPTION_MASTER_KEY } = getEnv();
  if (!ENCRYPTION_MASTER_KEY) return wallet;

  try {
    const pk = decryptPrivateKey(wallet.encryptedPrivateKey, ENCRYPTION_MASTER_KEY);
    const encryptedPrivateKey = encryptPrivateKey(pk, perUserKey);
    const updated = await prisma.wallet.update({
      where: { id: wallet.id },
      data: { encryptedPrivateKey },
    });
    logger.info({
      message: 'Auto-migrated wallet to per-user encryption key',
      walletId: wallet.id,
      address: wallet.address,
    });
    return mapWallet(updated, true);
  } catch {
    return wallet;
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function resetBotDailyNotional(bot: IBot): Promise<IBot> {
  const now = new Date();
  const start = startOfUtcDay(now);
  if (bot.dailyNotionalResetAt < start) {
    const updated = await prisma.bot.update({
      where: { id: bot.id },
      data: { dailyNotionalUSD: 0, dailyNotionalResetAt: now },
    });
    return mapBot(updated);
  }
  return bot;
}

async function resetWalletDaily(wallet: IWallet): Promise<IWallet> {
  const now = new Date();
  const start = startOfUtcDay(now);
  if (wallet.dailyResetAt < start) {
    const updated = await prisma.wallet.update({
      where: { id: wallet.id },
      data: { dailySpentNotional: 0, dailyResetAt: now },
    });
    return mapWallet(updated, true);
  }
  return wallet;
}

function emitLog(userId: string | undefined, botId: string, level: 'info' | 'warn' | 'error' | 'success', message: string, details?: Record<string, unknown>): void {
  if (!userId) return;
  emitBotLog(userId, { botId, level, message, details });
}

async function processExecutionJob(job: Job<{ botId: string; triggeredAt: number }>): Promise<void> {
  const { botId } = job.data;
  if (!isUuid(botId)) {
    logger.warn({ message: 'Skip execution: invalid bot id', jobId: job.id, botId });
    return;
  }
  const botRow = await prisma.bot.findUnique({ where: { id: botId } });

  if (!botRow || botRow.status !== 'active') {
    logger.warn({ message: 'Skip execution: bot not active', jobId: job.id, botId });
    if (botRow) {
      emitLog(botRow.createdBy, botId, 'warn', `Skipped run — bot status is ${botRow.status}`, { status: botRow.status });
    }
    return;
  }

  let bot = mapBot(botRow);
  const userId = bot.createdBy;
  emitLog(userId, botId, 'info', `Execution cycle started (${bot.strategyType})`, {
    strategyType: bot.strategyType,
    jobId: job.id,
  });

  if (bot.cooldownUntil && bot.cooldownUntil > new Date()) {
    logger.warn({ message: 'Bot in cooldown', botId });
    emitLog(userId, botId, 'warn', 'Skipped — bot is in cooldown; rescheduling.', {});
    await scheduleNextRun(botId, bot.intervalSeconds);
    return;
  }

  bot = await resetBotDailyNotional(bot);

  if (bot.consecutiveFailures >= 5) {
    await prisma.bot.update({
      where: { id: bot.id },
      data: { status: 'paused' },
    });
    await cancelBotExecution(botId);
    emitBotStatus(userId, botId, 'paused');
    emitBotError(userId, botId, 'Paused after consecutive failures');
    emitLog(userId, botId, 'error', 'Bot paused after 5 consecutive failures.', {});
    await sendTelegramAlert(userId, `Bot ${bot.name} paused after consecutive failures`);
    return;
  }

  const group = await prisma.walletGroup.findUnique({
    where: { id: bot.walletGroupId },
    include: { members: { select: { walletId: true } } },
  });
  const memberIds = group?.members.map((m) => m.walletId) ?? [];
  if (!group || memberIds.length === 0) {
    emitBotError(userId, botId, 'Wallet group empty');
    emitLog(userId, botId, 'error', 'Wallet group is empty; rescheduling.', {});
    await scheduleNextRun(botId, bot.intervalSeconds);
    return;
  }

  const walletRows = await prisma.wallet.findMany({
    where: {
      id: { in: memberIds },
      createdBy: bot.createdBy,
      status: 'active',
    },
  });
  let wallets = walletRows.map((w) => mapWallet(w, true));

  const encryptionKey = await getOrCreateUserEncryptionKey(bot.createdBy);

  for (let i = 0; i < wallets.length; i++) {
    wallets[i] = await autoMigrateWalletEncryption(wallets[i], encryptionKey);
  }

  for (let i = 0; i < wallets.length; i++) {
    wallets[i] = await resetWalletDaily(wallets[i]);
  }

  if (bot.dailyNotionalUSD >= bot.riskPolicy.maxDailyNotionalUSD) {
    logger.warn({ message: 'Daily notional cap reached', botId });
    emitLog(userId, botId, 'warn', 'Daily notional cap reached; rescheduling.', {
      dailyNotionalUSD: bot.dailyNotionalUSD,
      maxDailyNotionalUSD: bot.riskPolicy.maxDailyNotionalUSD,
    });
    await scheduleNextRun(botId, bot.intervalSeconds);
    return;
  }

  const intents = await generateIntents(bot, wallets);
  const limited = intents.slice(0, bot.riskPolicy.maxConcurrentWallets);

  emitLog(userId, botId, 'info', `Generated ${limited.length} execution intent(s) (of ${intents.length}).`, {
    intentCount: limited.length,
    walletCount: wallets.length,
  });

  const run = await prisma.botRun.create({
    data: {
      botId: bot.id,
      triggeredAt: new Date(job.data.triggeredAt),
      startedAt: new Date(),
      status: 'running',
      intentCount: limited.length,
      successCount: 0,
      failureCount: 0,
    },
  });

  let failures = 0;
  let successes = 0;
  let anyFailure = false;

  for (const intent of limited) {
    const wDoc = wallets.find((w) => w.id === intent.walletId);
    if (!wDoc) continue;

    emitLog(userId, botId, 'info', `Executing ${intent.side} intent for wallet ${intent.walletAddress.slice(0, 10)}…`, {
      side: intent.side,
      walletId: intent.walletId,
    });

    const result = await executeIntent({
      bot,
      wallet: wDoc,
      intent,
      botRunId: run.id,
      userId: bot.createdBy,
      encryptionKey,
    });

    if (result.failureCode) {
      failures += 1;
      anyFailure = true;
      emitLog(userId, botId, 'error', `Intent failed: ${result.failureCode}`, { failureCode: result.failureCode });
      await sendTelegramAlert(userId, `Bot ${bot.name} tx failed: ${result.failureCode}`);
    } else {
      successes += 1;
      emitLog(userId, botId, 'success', `${intent.side} intent submitted successfully.`, { side: intent.side });
    }
  }

  await prisma.botRun.update({
    where: { id: run.id },
    data: {
      successCount: successes,
      failureCount: failures,
      status: failures > 0 && successes === 0 ? 'failed' : 'completed',
      endedAt: new Date(),
    },
  });

  const botPatch: {
    consecutiveFailures?: number;
    cooldownUntil?: Date;
    lastRunAt: Date;
  } = { lastRunAt: new Date() };

  if (successes > 0) {
    botPatch.consecutiveFailures = 0;
  } else if (limited.length > 0) {
    botPatch.consecutiveFailures = bot.consecutiveFailures + 1;
  }

  if (anyFailure) {
    botPatch.cooldownUntil = new Date(Date.now() + bot.riskPolicy.cooldownOnFailureSeconds * 1000);
  }

  await prisma.bot.update({
    where: { id: bot.id },
    data: botPatch,
  });

  await scheduleNextRun(botId, bot.intervalSeconds);

  emitLog(userId, botId, 'success', `Cycle complete — ${successes} succeeded, ${failures} failed.`, {
    successCount: successes,
    failureCount: failures,
    runId: run.id,
  });
}

export async function startExecutionWorker(): Promise<void> {
  if (workerInstance) {
    logger.warn({ message: 'startExecutionWorker called but worker already running' });
    return;
  }

  if (!dbReady) {
    await connectDb();
    dbReady = true;
  }

  const connection = createBullmqConnection();

  workerInstance = new Worker<{ botId: string; triggeredAt: number }>(
    QUEUE_NAME,
    async (job) => {
      logger.info({
        message: 'Worker received job',
        jobId: job.id,
        jobName: job.name,
        botId: job.data?.botId,
        queueName: QUEUE_NAME,
      });
      try {
        await processExecutionJob(job);
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        logger.error({
          message: 'Worker job processing failed',
          jobId: job.id,
          botId: job.data?.botId,
          error: e.message,
          stack: e.stack,
        });
        try {
          const botId = job.data?.botId;
          if (botId && isUuid(botId)) {
            const b = await prisma.bot.findUnique({
              where: { id: botId },
              select: { createdBy: true },
            });
            if (b) {
              emitBotLog(b.createdBy, {
                botId,
                level: 'error',
                message: `Execution error: ${e.message}`,
                details: { stack: e.stack },
              });
            }
          }
        } catch {
          /* ignore emit errors */
        }
        throw err;
      }
    },
    { connection, concurrency: WORKER_CONCURRENCY }
  );

  workerInstance.on('ready', () => {
    logger.info({
      message: 'Execution worker is READY and listening',
      queueName: QUEUE_NAME,
      concurrency: WORKER_CONCURRENCY,
    });
  });

  workerInstance.on('active', (job) => {
    logger.info({
      message: 'Job is now ACTIVE',
      jobId: job.id,
      botId: job.data?.botId,
    });
  });

  workerInstance.on('completed', (job, result) => {
    logger.info({
      message: 'Job COMPLETED',
      jobId: job.id,
      botId: job.data?.botId,
      result,
    });
  });

  workerInstance.on('failed', (job, err) => {
    logger.error({
      message: 'Job FAILED',
      jobId: job?.id,
      botId: job?.data?.botId,
      error: err.message,
      stack: err.stack,
      attemptsMade: job?.attemptsMade,
    });
  });

  workerInstance.on('error', (err) => {
    logger.error({
      message: 'Worker ERROR (check Redis connectivity)',
      error: err.message,
      stack: err.stack,
    });
  });

  workerInstance.on('stalled', (jobId) => {
    logger.warn({
      message: 'Job STALLED',
      jobId,
    });
  });

  logger.info({
    message: 'Execution worker started',
    queueName: QUEUE_NAME,
    concurrency: WORKER_CONCURRENCY,
  });
}

function isExecutedAsCli(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isExecutedAsCli()) {
  startExecutionWorker().catch((err: unknown) => {
    logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exit(1);
  });
}
