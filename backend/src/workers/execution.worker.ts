import { loadEnv } from '../config/env.js';
loadEnv();

import { pathToFileURL } from 'node:url';
import { Worker, type Job } from 'bullmq';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { createBullmqConnection } from '../config/bullmqRedis.js';
import { QUEUE_NAMES } from '../config/queues.js';
import { Bot } from '../models/Bot.js';
import type { IBot } from '../models/Bot.js';
import { BotRun } from '../models/BotRun.js';
import { Wallet } from '../models/Wallet.js';
import { WalletGroup } from '../models/WalletGroup.js';
import { cancelBotExecution, scheduleNextRun } from '../services/scheduler.service.js';
import { executeIntent } from '../services/executor.service.js';
import { generateIntents } from '../services/strategy.service.js';
import { logger } from '../utils/logger.js';
import { emitBotError, emitBotLog, emitBotStatus } from '../socket/txStream.js';
import { sendTelegramAlert } from '../services/telegram.service.js';
import { getOrCreateUserEncryptionKey } from '../utils/userKey.js';
import { decryptPrivateKey, encryptPrivateKey } from '../utils/crypto.js';
import { getEnv } from '../config/env.js';
import type { IWallet } from '../models/Wallet.js';

logger.info({ message: 'Execution worker module loaded' });

const QUEUE_NAME = QUEUE_NAMES.BOT_EXECUTION;
const WORKER_CONCURRENCY = 3;

let workerInstance: Worker<{ botId: string; triggeredAt: number }> | null = null;

/**
 * Transparent migration: if a wallet was encrypted with the old global
 * ENCRYPTION_MASTER_KEY (from .env) and the per-user key can't decrypt it,
 * attempt decryption with the legacy key and silently re-encrypt under the
 * per-user key. Works for every user automatically — no manual intervention.
 */
async function autoMigrateWalletEncryption(
  wallet: IWallet & { save(): Promise<unknown> },
  perUserKey: string
): Promise<void> {
  try {
    decryptPrivateKey(wallet.encryptedPrivateKey, perUserKey);
    return; // already encrypted with per-user key — nothing to do
  } catch {
    // fall through to legacy key attempt
  }

  const { ENCRYPTION_MASTER_KEY } = getEnv();
  if (!ENCRYPTION_MASTER_KEY) return; // no legacy key available — cannot auto-migrate

  try {
    const pk = decryptPrivateKey(wallet.encryptedPrivateKey, ENCRYPTION_MASTER_KEY);
    wallet.encryptedPrivateKey = encryptPrivateKey(pk, perUserKey);
    await wallet.save();
    logger.info({
      message: 'Auto-migrated wallet to per-user encryption key',
      walletId: String(wallet._id),
      address: wallet.address,
    });
  } catch {
    // legacy key also failed — wallet is genuinely broken; executeIntent will surface it
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function resetBotDailyNotional(bot: IBot): Promise<void> {
  const now = new Date();
  const start = startOfUtcDay(now);
  if (bot.dailyNotionalResetAt < start) {
    bot.dailyNotionalUSD = 0;
    bot.dailyNotionalResetAt = now;
    await bot.save();
  }
}

async function resetWalletDaily(
  wallet: mongoose.Document & { dailySpentNotional: number; dailyResetAt: Date }
): Promise<void> {
  const now = new Date();
  const start = startOfUtcDay(now);
  if (wallet.dailyResetAt < start) {
    wallet.dailySpentNotional = 0;
    wallet.dailyResetAt = now;
    await wallet.save();
  }
}

function emitLog(userId: string | undefined, botId: string, level: 'info' | 'warn' | 'error' | 'success', message: string, details?: Record<string, unknown>): void {
  if (!userId) return;
  emitBotLog(userId, { botId, level, message, details });
}

async function processExecutionJob(job: Job<{ botId: string; triggeredAt: number }>): Promise<void> {
  const { botId } = job.data;
  const bot = await Bot.findById(botId);

  if (!bot || bot.status !== 'active') {
    logger.warn({ message: 'Skip execution: bot not active', jobId: job.id, botId });
    if (bot) {
      emitLog(String(bot.createdBy), botId, 'warn', `Skipped run — bot status is ${bot.status}`, { status: bot.status });
    }
    return;
  }

  const userId = String(bot.createdBy);
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

  await resetBotDailyNotional(bot);

  if (bot.consecutiveFailures >= 5) {
    bot.status = 'paused';
    await bot.save();
    await cancelBotExecution(botId);
    emitBotStatus(userId, botId, 'paused');
    emitBotError(userId, botId, 'Paused after consecutive failures');
    emitLog(userId, botId, 'error', 'Bot paused after 5 consecutive failures.', {});
    await sendTelegramAlert(userId, `Bot ${bot.name} paused after consecutive failures`);
    return;
  }

  const group = await WalletGroup.findById(bot.walletGroupId);
  if (!group || group.walletIds.length === 0) {
    emitBotError(userId, botId, 'Wallet group empty');
    emitLog(userId, botId, 'error', 'Wallet group is empty; rescheduling.', {});
    await scheduleNextRun(botId, bot.intervalSeconds);
    return;
  }

  const wallets = await Wallet.find({
    _id: { $in: group.walletIds },
    createdBy: bot.createdBy,
    status: 'active',
  }).select('+encryptedPrivateKey');

  const encryptionKey = await getOrCreateUserEncryptionKey(bot.createdBy);

  // Auto-migrate any wallet still encrypted with the legacy ENCRYPTION_MASTER_KEY
  for (const w of wallets) {
    await autoMigrateWalletEncryption(w, encryptionKey);
  }

  for (const w of wallets) {
    await resetWalletDaily(w);
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

  const run = await BotRun.create({
    botId: bot._id,
    triggeredAt: new Date(job.data.triggeredAt),
    startedAt: new Date(),
    status: 'running',
    intentCount: limited.length,
    successCount: 0,
    failureCount: 0,
  });

  let failures = 0;
  let successes = 0;
  let anyFailure = false;

  for (const intent of limited) {
    const wDoc = wallets.find((w) => String(w._id) === intent.walletId);
    if (!wDoc) continue;

    emitLog(userId, botId, 'info', `Executing ${intent.side} intent for wallet ${intent.walletAddress.slice(0, 10)}…`, {
      side: intent.side,
      walletId: intent.walletId,
    });

    const result = await executeIntent({
      bot,
      wallet: wDoc,
      intent,
      botRunId: run._id,
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

  run.successCount = successes;
  run.failureCount = failures;
  run.status = failures > 0 && successes === 0 ? 'failed' : 'completed';
  run.endedAt = new Date();
  await run.save();

  if (successes > 0) {
    bot.consecutiveFailures = 0;
  } else if (limited.length > 0) {
    bot.consecutiveFailures += 1;
  }

  if (anyFailure) {
    bot.cooldownUntil = new Date(Date.now() + bot.riskPolicy.cooldownOnFailureSeconds * 1000);
  }

  bot.lastRunAt = new Date();
  await bot.save();

  await scheduleNextRun(botId, bot.intervalSeconds);

  emitLog(userId, botId, 'success', `Cycle complete — ${successes} succeeded, ${failures} failed.`, {
    successCount: successes,
    failureCount: failures,
    runId: String(run._id),
  });
}

export async function startExecutionWorker(): Promise<void> {
  if (workerInstance) {
    logger.warn({ message: 'startExecutionWorker called but worker already running' });
    return;
  }

  if (mongoose.connection.readyState !== 1) {
    await connectDb();
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
          const b = await Bot.findById(job.data?.botId);
          if (b) {
            emitBotLog(String(b.createdBy), {
              botId: String(job.data.botId),
              level: 'error',
              message: `Execution error: ${e.message}`,
              details: { stack: e.stack },
            });
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
