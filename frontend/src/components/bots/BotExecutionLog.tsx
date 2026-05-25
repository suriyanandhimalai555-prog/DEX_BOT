import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { cn } from '../../lib/utils';

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  time: string;
  level: LogLevel;
  message: string;
}

interface BotExecutionLogProps {
  botId: string;
}

function botIdFromTx(t: { botId?: unknown } | undefined): string {
  if (!t?.botId) return '';
  const b = t.botId;
  return typeof b === 'object' && b !== null && 'toString' in b ? String((b as { toString(): string }).toString()) : String(b);
}

export function BotExecutionLog({ botId }: BotExecutionLogProps): JSX.Element {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const socket = useSocket(true);

  useEffect(() => {
    if (!socket) return;

    const handleBotLog = (data: { botId?: string; level?: LogLevel; message?: string }): void => {
      if (data.botId !== botId || !data.message) return;
      const level = data.level ?? 'info';
      setLogs((prev) =>
        [
          ...prev.slice(-99),
          {
            time: new Date().toLocaleTimeString(),
            level,
            message: data.message!,
          },
        ]
      );
    };

    const onTxSubmitted = (p: { transaction?: { botId?: unknown; side?: string; inputAmount?: string; txHash?: string } }): void => {
      const t = p.transaction;
      const bid = botIdFromTx(t);
      if (bid !== botId || !t) return;
      const hash = t.txHash ? `${t.txHash.slice(0, 10)}…` : 'pending';
      setLogs((prev) => [
        ...prev.slice(-99),
        {
          time: new Date().toLocaleTimeString(),
          level: 'success' as const,
          message: `Swap submitted — ${(t.side ?? '').toUpperCase()} ${t.inputAmount ?? ''} · tx ${hash}`,
        },
      ]);
    };

    const onTxConfirmed = (p: { transaction?: { botId?: unknown; side?: string; executedPrice?: string } }): void => {
      const t = p.transaction;
      const bid = botIdFromTx(t);
      if (bid !== botId || !t) return;
      setLogs((prev) => [
        ...prev.slice(-99),
        {
          time: new Date().toLocaleTimeString(),
          level: 'success' as const,
          message: `Confirmed — ${(t.side ?? '').toUpperCase()}${t.executedPrice ? ` @ ${t.executedPrice}` : ''}`,
        },
      ]);
    };

    const onTxFailed = (p: { transaction?: { botId?: unknown }; failureCode?: string }): void => {
      const t = p.transaction;
      const bid = botIdFromTx(t);
      if (bid !== botId) return;
      setLogs((prev) => [
        ...prev.slice(-99),
        {
          time: new Date().toLocaleTimeString(),
          level: 'error' as const,
          message: `Failed — ${p.failureCode ?? 'unknown'}`,
        },
      ]);
    };

    socket.on('bot:log', handleBotLog);
    socket.on('tx:submitted', onTxSubmitted);
    socket.on('tx:confirmed', onTxConfirmed);
    socket.on('tx:failed', onTxFailed);

    return () => {
      socket.off('bot:log', handleBotLog);
      socket.off('tx:submitted', onTxSubmitted);
      socket.off('tx:confirmed', onTxConfirmed);
      socket.off('tx:failed', onTxFailed);
    };
  }, [socket, botId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  const levelClass: Record<LogLevel, string> = {
    info: 'text-[var(--text-secondary)]',
    warn: 'text-[var(--warning)]',
    error: 'text-[var(--danger)]',
    success: 'text-[var(--brand)]',
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-depth)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand)]" />
          </span>
          <span className="text-xs font-mono font-medium text-[var(--text-muted)]">Bot execution log</span>
        </div>
        <button
          type="button"
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          onClick={() => setLogs([])}
        >
          Clear
        </button>
      </div>

      <div ref={scrollRef} className="h-48 space-y-0.5 overflow-y-auto p-3 font-mono text-xs" data-lenis-prevent-wheel>
        {logs.length === 0 ? (
          <p className="py-8 text-center text-[var(--text-muted)]">Waiting for execution events…</p>
        ) : (
          logs.map((log, i) => (
            <div key={`${log.time}-${i}`} className="flex gap-2 leading-relaxed">
              <span className="shrink-0 text-[var(--text-muted)]">{log.time}</span>
              <span className={cn('min-w-0 break-words', levelClass[log.level])}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
