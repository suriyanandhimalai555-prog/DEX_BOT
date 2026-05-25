/** BullMQ queue names — single source of truth for producers and workers. */
export const QUEUE_NAMES = {
  BOT_EXECUTION: 'bot-execution',
} as const;

export type QueueNameKey = keyof typeof QUEUE_NAMES;
