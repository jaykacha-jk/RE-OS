import type { PropertyKpis } from '../../lib/analytics';
import { formatNumber, formatPercent } from '../../lib/analytics';
import { EmptyState } from './chart-card';

const STATUS_META: { key: string; label: string; color: string }[] = [
  { key: 'draft', label: 'Draft', color: 'bg-slate-400' },
  { key: 'pending_review', label: 'Pending', color: 'bg-amber-400' },
  { key: 'published', label: 'Published', color: 'bg-teal-500' },
  { key: 'reserved', label: 'Reserved', color: 'bg-indigo-500' },
  { key: 'sold', label: 'Sold', color: 'bg-emerald-500' },
  { key: 'archived', label: 'Archived', color: 'bg-slate-300' },
];

/**
 * Property inventory by status: a stacked share bar + a labelled breakdown
 * with absolute counts and share of total.
 */
export function PropertyStatusChart({ properties }: { properties: PropertyKpis }) {
  const byStatus = properties.by_status ?? {};
  const total = properties.total;

  if (!total) {
    return (
      <EmptyState
        title="No properties yet"
        message="Add properties to your inventory to track Published, Reserved and Sold counts here."
      />
    );
  }

  const rows = STATUS_META.map((s) => ({ ...s, count: byStatus[s.key] ?? 0 })).filter((s) => s.count > 0);
  const max = Math.max(1, ...rows.map((s) => s.count));

  return (
    <div>
      {/* Stacked share bar */}
      <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Inventory share by status">
        {rows.map((s) => (
          <div key={s.key} className={s.color} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>

      <div className="space-y-2.5">
        {rows.map((s) => {
          const pct = (s.count / max) * 100;
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div className="flex w-24 shrink-0 items-center gap-2 text-xs text-slate-600">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${s.color}`} />
                {s.label}
              </div>
              <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                <div className={`h-full rounded ${s.color} transition-all`} style={{ width: `${Math.max(pct, 4)}%` }} />
              </div>
              <div className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-600">
                {formatNumber(s.count)} <span className="text-slate-400">· {formatPercent((s.count / total) * 100)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
