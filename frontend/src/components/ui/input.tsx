import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]',
          className
        )}
        {...props}
      />
    );
  }
);
