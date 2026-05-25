import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePanelBase } from '../../hooks/usePanelBase';
import type { BotSummary } from '../../api/types';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ArrowRight, Pause, Play, Square, Trash2 } from 'lucide-react';
import { cardHoverEnter, cardHoverLeave, flashBotCard } from '../../lib/animations';
import { cn } from '../../lib/utils';
import { getDexLabel } from '../../config/dexOptions';

export function BotCard({
  bot,
  onStart,
  onPause,
  onStop,
  onResume,
  onDelete,
  deleteInProgress,
}: {
  bot: BotSummary;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onResume?: () => void;
  onDelete: () => void;
  deleteInProgress?: boolean;
}): JSX.Element {
  const navigate = useNavigate();
  const base = usePanelBase();
  const cardRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef(bot.status);

  useEffect(() => {
    if (!cardRef.current || prevStatusRef.current === bot.status) return;
    if (bot.status === 'active') flashBotCard(cardRef.current, 'success');
    else if (bot.status === 'paused') flashBotCard(cardRef.current, 'warning');
    else if (bot.status === 'stopped' || bot.status === 'failed' || bot.status === 'errored')
      flashBotCard(cardRef.current, 'danger');
    prevStatusRef.current = bot.status;
  }, [bot.status]);

  const statusStyles =
    bot.status === 'active'
      ? 'border border-[var(--brand)]/40 bg-[var(--brand-bg)] text-[var(--brand-dark)]'
      : bot.status === 'paused'
        ? 'border border-amber-500/35 bg-[var(--warning-bg)] text-[var(--warning)]'
        : bot.status === 'stopped' || bot.status === 'failed' || bot.status === 'errored'
          ? 'border border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]'
          : 'border border-[var(--border)] bg-[var(--bg-depth)] text-[var(--text-secondary)]';

  const canDelete = bot.status !== 'active';
  const deleteDisabled = !canDelete || deleteInProgress;

  return (
    <Card
      ref={cardRef}
      data-gsap
      className="bot-card rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
      onMouseEnter={() => cardRef.current && cardHoverEnter(cardRef.current)}
      onMouseLeave={() => cardRef.current && cardHoverLeave(cardRef.current)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-[var(--text-primary)]">{bot.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-depth)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              {bot.strategyType}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {bot.dexLabel ?? getDexLabel(bot.dex ?? 'pancakeswap', bot.dexVersion)} · BSC
            </span>
          </div>
          {bot.routerAddress ? (
            <div className="mt-1 font-mono text-[10px] text-[var(--text-muted)]" title={bot.routerAddress}>
              {bot.routerAddress.slice(0, 6)}…{bot.routerAddress.slice(-4)}
            </div>
          ) : null}
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', statusStyles)}>
          {bot.status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-[var(--bg-depth)] p-2">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Today&apos;s Trades</div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">—</div>
        </div>
        <div className="rounded-lg bg-[var(--bg-depth)] p-2">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Success Rate</div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">—</div>
        </div>
        <div className="rounded-lg bg-[var(--bg-depth)] p-2">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Failures</div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">{bot.consecutiveFailures}</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-[var(--text-muted)]">
        Last run: {bot.lastRunAt ? new Date(bot.lastRunAt).toLocaleString() : 'Never run'}
      </div>

      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <div className="flex flex-wrap gap-2">
          {bot.status === 'draft' && (
            <Button type="button" className="bg-[var(--brand)] px-3 py-2 text-xs text-white hover:bg-[var(--brand-dark)]" onClick={onStart}>
              <Play className="mr-1 h-3.5 w-3.5" />
              Start
            </Button>
          )}

          {bot.status === 'active' && (
            <Button
              type="button"
              variant="outline"
              className="border border-amber-500/40 bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)] hover:opacity-90"
              onClick={onPause}
            >
              <Pause className="mr-1 h-3.5 w-3.5" />
              Pause
            </Button>
          )}

          {bot.status === 'paused' && (
            <Button
              type="button"
              className="bg-[var(--brand)] px-3 py-2 text-xs text-white hover:bg-[var(--brand-dark)]"
              onClick={onResume ?? onStart}
            >
              <Play className="mr-1 h-3.5 w-3.5" />
              Resume
            </Button>
          )}

          {(bot.status === 'stopped' || bot.status === 'errored') && (
            <Button type="button" className="bg-[var(--brand)] px-3 py-2 text-xs text-white hover:bg-[var(--brand-dark)]" onClick={onStart}>
              <Play className="mr-1 h-3.5 w-3.5" />
              Restart
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            className="border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger)] hover:opacity-95"
            onClick={onStop}
          >
            <Square className="mr-1 h-3.5 w-3.5" />
            Stop
          </Button>

          <Button
            type="button"
            variant="outline"
            className="px-3 py-2 text-xs"
            onClick={() => navigate(`${base}/bots/${bot.id}`)}
          >
            <ArrowRight className="mr-1 h-3.5 w-3.5" />
            View
          </Button>

          <Button
            type="button"
            variant="danger"
            className="px-3 py-2 text-xs"
            disabled={deleteDisabled}
            title={
              !canDelete
                ? 'Stop the bot before deleting'
                : deleteInProgress
                  ? 'Deleting…'
                  : 'Permanently delete this bot'
            }
            onClick={() => {
              if (canDelete && !deleteInProgress) onDelete();
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}
