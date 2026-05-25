import { Queue } from 'bullmq';
import { createBullmqConnection } from '../config/bullmqRedis.js';
import { QUEUE_NAMES } from '../config/queues.js';
import { logger } from '../utils/logger.js';

let queue: Queue<{ botId: string; triggeredAt: number }> | null = null;

export function getBotQueue(): Queue<{ botId: string; triggeredAt: number }> {
  if (!queue) {
    queue = new Queue<{ botId: string; triggeredAt: number }>(QUEUE_NAMES.BOT_EXECUTION, {
      connection: createBullmqConnection(),
    });
  }
  return queue;
}

function computeDelayMs(intervalSeconds: number): number {
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.floor(intervalSeconds * 1000 * jitter);
}

export async function scheduleBotExecution(
  botId: string,
  intervalSeconds: number
): Promise<void> {
  await cancelBotExecution(botId);
  const q = getBotQueue();
  const delay = computeDelayMs(intervalSeconds);
  const job = await q.add(
    'execute',
    { botId, triggeredAt: Date.now() },
    {
      jobId: `bot-${botId}`,
      delay,
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
  logger.info(`Scheduled bot job botId=${botId} delayMs=${delay}`);
  const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused');
  logger.info({
    message: 'BullMQ job details',
    queueName: QUEUE_NAMES.BOT_EXECUTION,
    jobId: job.id,
    jobName: job.name,
    delayMs: delay,
    timestamp: new Date().toISOString(),
  });
  logger.info({
    message: 'Queue state after scheduling',
    queueName: QUEUE_NAMES.BOT_EXECUTION,
    counts,
  });
}

export async function scheduleNextRun(
  botId: string,
  intervalSeconds: number
): Promise<void> {
  const q = getBotQueue();
  const delay = computeDelayMs(intervalSeconds);
  const job = await q.add(
    'execute',
    { botId, triggeredAt: Date.now() },
    {
      jobId: `bot-${botId}-${Date.now()}`,
      delay,
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
  logger.info(`Scheduled next run botId=${botId} delayMs=${delay}`);
  const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused');
  logger.info({
    message: 'BullMQ scheduleNextRun job details',
    queueName: QUEUE_NAMES.BOT_EXECUTION,
    jobId: job.id,
    jobName: job.name,
    delayMs: delay,
    timestamp: new Date().toISOString(),
  });
  logger.info({
    message: 'Queue state after scheduleNextRun',
    queueName: QUEUE_NAMES.BOT_EXECUTION,
    counts,
  });
}

export async function cancelBotExecution(botId: string): Promise<void> {
  const q = getBotQueue();
  const jobs = await q.getJobs(['delayed', 'waiting', 'paused']);
  await Promise.all(
    jobs
      .filter((j) => j.data?.botId === botId)
      .map(async (j) => {
        try {
          await j.remove();
        } catch {
          /* ignore */
        }
      })
  );
  try {
    const job = await q.getJob(`bot-${botId}`);
    if (job) await job.remove();
  } catch {
    /* ignore */
  }
  logger.info(`Cancelled bot jobs botId=${botId}`);
}
