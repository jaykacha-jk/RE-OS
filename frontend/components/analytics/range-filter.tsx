'use client';

import { ANALYTICS_RANGES, type AnalyticsRange } from '../../lib/analytics';

/**
 * Time-window selector shared by every analytics page.
 * Today · 7d · 30d · 90d · Custom (with date inputs).
 */
export function RangeFilter({
  range,
  from,
  to,
  onRangeChange,
  onFromChange,
  onToChange,
}: {
  range: AnalyticsRange;
  from: string;
  to: string;
  onRangeChange: (r: AnalyticsRange) => void;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
        {ANALYTICS_RANGES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onRangeChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium transition ${
              range === opt.value
                ? 'bg-teal-700 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {range === 'custom' ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            aria-label="From date"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            aria-label="To date"
          />
        </div>
      ) : null}
    </div>
  );
}
