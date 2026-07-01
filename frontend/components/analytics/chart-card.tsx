import type { ReactNode } from 'react';

/**
 * Wrapper for any chart/visualization with a title and optional action slot.
 */
export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-reos-border bg-white p-5 shadow-card ${className}`}>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Reusable skeleton block for loading states. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

/** Grid of KPI skeletons for the dashboard loading state. */
export function KpiSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-reos-border bg-white p-5 shadow-card">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-8 w-28" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export { EmptyState } from '../shared/EmptyState';
