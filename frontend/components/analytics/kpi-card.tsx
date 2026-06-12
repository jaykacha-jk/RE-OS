import type { ReactNode } from 'react';

type Tone = 'default' | 'teal' | 'green' | 'amber' | 'rose' | 'indigo';

const toneClasses: Record<Tone, string> = {
  default: 'border-reos-border bg-white',
  teal: 'border-teal-200 bg-gradient-to-br from-white to-teal-50',
  green: 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50',
  amber: 'border-amber-200 bg-gradient-to-br from-white to-amber-50',
  rose: 'border-rose-200 bg-gradient-to-br from-white to-rose-50',
  indigo: 'border-blue-200 bg-gradient-to-br from-white to-blue-50',
};

const accentText: Record<Tone, string> = {
  default: 'text-slate-900',
  teal: 'text-teal-800',
  green: 'text-emerald-800',
  amber: 'text-amber-800',
  rose: 'text-rose-800',
  indigo: 'text-indigo-800',
};

const iconTone: Record<Tone, string> = {
  default: 'bg-slate-100 text-slate-500',
  teal: 'bg-teal-100 text-teal-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
  indigo: 'bg-indigo-100 text-indigo-700',
};

/**
 * Primary headline metric tile used across all dashboards.
 */
export function KPICard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-5 shadow-card transition duration-150 hover:-translate-y-0.5 hover:shadow-raised ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        {icon ? <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconTone[tone]}`}>{icon}</span> : null}
      </div>
      <p className={`mt-3 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl ${accentText[tone]}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

/**
 * Compact secondary metric used inside chart cards / breakdown rows.
 */
export function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-reos-border bg-white px-3 py-2 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</p>
      {sub ? <p className="text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}
