import { Info } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TradeSideToggleProps {
  buyEnabled: boolean;
  sellEnabled: boolean;
  onBuyChange: (v: boolean) => void;
  onSellChange: (v: boolean) => void;
  strategyType: string;
}

export function TradeSideToggle({
  buyEnabled,
  sellEnabled,
  onBuyChange,
  onSellChange,
  strategyType,
}: TradeSideToggleProps): JSX.Element {
  const isVolumeCycle = strategyType === 'volume_cycle';

  return (
    <div>
      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
        Trade direction
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={isVolumeCycle}
          onClick={() => {
            if (!isVolumeCycle) onBuyChange(!buyEnabled);
          }}
          className={cn(
            'flex flex-1 items-center justify-between rounded-xl border-2 px-4 py-3 transition-all duration-200',
            buyEnabled
              ? 'border-[var(--brand)] bg-[var(--brand-bg)]'
              : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]',
            isVolumeCycle ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Buy</span>
            <span className="text-xs text-[var(--text-secondary)]">↑</span>
          </div>
          <div
            className={cn(
              'relative h-5 w-9 rounded-full transition-colors duration-200',
              buyEnabled ? 'bg-[var(--brand)]' : 'bg-[var(--bg-depth)]'
            )}
          >
            <div
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-[var(--bg-surface)] shadow-sm ring-1 ring-[var(--border)] transition-transform duration-200',
                buyEnabled ? 'translate-x-4' : 'translate-x-0.5'
              )}
            />
          </div>
        </button>

        <button
          type="button"
          disabled={isVolumeCycle}
          onClick={() => {
            if (!isVolumeCycle) onSellChange(!sellEnabled);
          }}
          className={cn(
            'flex flex-1 items-center justify-between rounded-xl border-2 px-4 py-3 transition-all duration-200',
            sellEnabled
              ? 'border-[var(--danger)] bg-[var(--danger-bg)]'
              : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]',
            isVolumeCycle ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Sell</span>
            <span className="text-xs text-[var(--text-secondary)]">↓</span>
          </div>
          <div
            className={cn(
              'relative h-5 w-9 rounded-full transition-colors duration-200',
              sellEnabled ? 'bg-[var(--danger)]' : 'bg-[var(--bg-depth)]'
            )}
          >
            <div
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-[var(--bg-surface)] shadow-sm ring-1 ring-[var(--border)] transition-transform duration-200',
                sellEnabled ? 'translate-x-4' : 'translate-x-0.5'
              )}
            />
          </div>
        </button>
      </div>

      {isVolumeCycle ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--info)]" />
          Volume cycle requires both buy and sell enabled.
        </p>
      ) : null}

      {!buyEnabled && !sellEnabled && !isVolumeCycle ? (
        <p className="mt-2 text-xs text-[var(--danger)]">At least one direction must be enabled.</p>
      ) : null}
    </div>
  );
}
