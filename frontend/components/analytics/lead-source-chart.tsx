import type { SourceRow } from '../../lib/analytics';
import { formatNumber, formatPercent } from '../../lib/analytics';
import { EmptyState } from './chart-card';

const PALETTE = [
  '#0f766e', // teal-700
  '#0891b2', // cyan-600
  '#6366f1', // indigo-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#10b981', // emerald-500
  '#64748b', // slate-500
];

/**
 * Lead source breakdown as a CSS conic-gradient donut + legend.
 * Dependency-free (no chart library) for fast loads.
 */
export function LeadSourceChart({ sources }: { sources: SourceRow[] }) {
  const total = sources.reduce((sum, s) => sum + s.count, 0);
  if (!total) {
    return (
      <EmptyState
        title="No lead sources yet"
        message="Tag your inquiries with sources (Website, WhatsApp, Referral…) to see what drives leads."
      />
    );
  }

  let acc = 0;
  const segments = sources.map((s, i) => {
    const start = (acc / total) * 360;
    acc += s.count;
    const end = (acc / total) * 360;
    return `${PALETTE[i % PALETTE.length]} ${start}deg ${end}deg`;
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div
        className="h-36 w-36 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${segments.join(', ')})` }}
        role="img"
        aria-label="Lead source distribution"
      >
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
            <span className="text-base font-semibold text-slate-800">{formatNumber(total)}</span>
            <span className="text-[10px] text-slate-500">leads</span>
          </div>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5">
        {sources.map((s, i) => (
          <li key={s.source} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              {s.source}
            </span>
            <span className="tabular-nums text-slate-500">
              {formatNumber(s.count)} · {formatPercent((s.count / total) * 100)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
