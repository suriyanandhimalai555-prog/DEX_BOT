export type BotRunStatus = 'running' | 'completed' | 'failed';

export interface IBotRun {
  id: string;
  botId: string;
  triggeredAt: Date;
  startedAt: Date;
  endedAt?: Date | null;
  status: BotRunStatus;
  intentCount: number;
  successCount: number;
  failureCount: number;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
