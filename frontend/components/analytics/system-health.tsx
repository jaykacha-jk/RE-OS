import { Icon, type IconName } from '../ui/icons';

type Status = 'ok' | 'warn' | 'down';

export type HealthRow = {
  label: string;
  detail: string;
  status: Status;
  icon: IconName;
};

const DOT: Record<Status, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  down: 'bg-rose-500',
};

const LABEL: Record<Status, string> = {
  ok: 'Operational',
  warn: 'Degraded',
  down: 'Down',
};

/** Compact service / data-health panel for the dashboard right rail. */
export function SystemHealth({ rows, updatedAt }: { rows: HealthRow[]; updatedAt?: string }) {
  const hasIssue = rows.some((row) => row.status !== 'ok');
  return (
    <section className="card p-5">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-h3">Data health</h3>
          <p className="text-caption mt-1">Verified dashboard signals</p>
        </div>
        <span className={hasIssue ? 'badge badge-amber' : 'badge badge-green'}>
          <span className={`h-1.5 w-1.5 rounded-full ${hasIssue ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {hasIssue ? 'Needs attention' : 'Verified'}
        </span>
      </header>

      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <Icon name={row.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-800">{row.label}</span>
              <span className="block truncate text-xs text-slate-500">{row.detail}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-2xs font-medium text-slate-500">
              <span className={`h-2 w-2 rounded-full ${DOT[row.status]}`} />
              {LABEL[row.status]}
            </span>
          </li>
        ))}
      </ul>

      {updatedAt ? (
        <p className="mt-3 border-t border-reos-border pt-3 text-2xs text-slate-400">
          Data refreshed {new Date(updatedAt).toLocaleString('en-IN')}
        </p>
      ) : null}
    </section>
  );
}
