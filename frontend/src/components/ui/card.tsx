import { cn } from '../../lib/utils';
import { forwardRef, type HTMLAttributes } from 'react';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn('rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]', className)}
      {...props}
    />
  );
});
