import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  /** Alias for description (chart/analytics callers). */
  message?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, message, action }: EmptyStateProps) {
  const body = description ?? message;
  return (
    <div className="rounded-3xl border border-dashed border-teal-200 bg-white p-10 text-center shadow-card">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7">
          <path d="M3 10.5 12 4l9 6.5" />
          <path d="M5 9.5V20h14V9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">{title}</h3>
      {body ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{body}</p>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
