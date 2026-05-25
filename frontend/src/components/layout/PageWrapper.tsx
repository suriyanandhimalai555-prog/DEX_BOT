import type { ReactNode } from 'react';

export function PageWrapper({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-1 flex-col gap-4">
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4">
          {title ? (
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h1>
          ) : (
            <div />
          )}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
