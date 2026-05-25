import { cn } from '../../lib/utils';
import type { ButtonHTMLAttributes } from 'react';
import { animateButtonPress } from '../../lib/animations';

export function Button({
  className,
  variant = 'default',
  type = 'button',
  onMouseDown,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'danger' }) {
  const styles =
    variant === 'outline'
      ? 'border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-depth)]'
      : variant === 'ghost'
        ? 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-depth)]'
        : variant === 'danger'
          ? 'bg-[var(--danger)] text-white hover:opacity-95'
          : 'btn-primary bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]';

  return (
    <button
      type={type}
      onMouseDown={(e) => {
        onMouseDown?.(e);
        if (!props.disabled) animateButtonPress(e.currentTarget);
      }}
      className={cn(
        'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition',
        styles,
        className
      )}
      {...props}
    />
  );
}
