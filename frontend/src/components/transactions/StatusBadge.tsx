import { cn } from '../../lib/utils';

export function StatusBadge({ status }: { status: string }): JSX.Element {
  const color =
    status === 'confirmed'
      ? 'bg-[var(--brand-bg)] text-[var(--brand-dark)]'
      : status === 'failed'
        ? 'bg-[var(--danger-bg)] text-[var(--danger)]'
        : status === 'submitted'
          ? 'bg-[var(--warning-bg)] text-[var(--warning)]'
          : 'bg-[var(--bg-depth)] text-[var(--text-secondary)]';
  return (
    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', color)}>
      {status}
    </span>
  );
}
