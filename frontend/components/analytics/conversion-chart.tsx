'use client';

import { useState } from 'react';

import type { MonthlyConversion, MonthlyLead } from '../../lib/analytics';
import { formatNumber, formatPercent, monthLabel } from '../../lib/analytics';
import { EmptyState } from './chart-card';

/**
 * Executive combo chart: grouped Leads / Won bars with a conversion-rate
 * trend line overlaid on a secondary axis. Hovering a month reveals a rich
 * tooltip. Pure SVG + HTML, no chart library.
 */
export function ConversionChart({ data }: { data: MonthlyConversion[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) {
    return (
      <EmptyState
        title="Not enough history"
        message="Monthly conversion trends appear once you have leads across multiple months."
      />
    );
  }

  const maxLeads = Math.max(1, ...data.map((d) => d.leads));
  const maxConv = Math.max(1, ...data.map((d) => d.conversion_rate));
  const H = 160; // chart body height (px)

  // Conversion trend line points (0..1 of width per slot, centered).
  const linePoints = data
    .map((d, i) => {
      const x = ((i + 0.5) / data.length) * 100;
      const y = H - (d.conversion_rate / maxConv) * (H - 16);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div>
      <div className="relative">
        {/* gridlines */}
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: H }}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-dashed border-slate-100" style={{ top: t * H }} />
          ))}
        </div>

        {/* conversion trend line overlay */}
        <svg
          className="pointer-events-none absolute inset-x-0 top-0 overflow-visible"
          style={{ height: H }}
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <polyline points={linePoints} fill="none" stroke="#b7791f" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>

        {/* bars */}
        <div className="relative flex items-end gap-2" style={{ height: H }}>
          {data.map((d, i) => (
            <div
              key={d.month}
              className="group relative flex h-full flex-1 cursor-default items-end justify-center gap-1"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className="w-2.5 rounded-t bg-slate-300 transition-all sm:w-3"
                style={{ height: `${(d.leads / maxLeads) * (H - 8)}px` }}
              />
              <div
                className="w-2.5 rounded-t bg-teal-600 transition-all sm:w-3"
                style={{ height: `${(d.won / maxLeads) * (H - 8)}px` }}
              />
              {hover === i ? (
                <div className="absolute -top-2 left-1/2 z-10 w-36 -translate-x-1/2 -translate-y-full rounded-xl border border-reos-border bg-white p-2.5 text-left shadow-dropdown">
                  <p className="text-2xs font-bold uppercase tracking-wide text-slate-400">{monthLabel(d.month)}</p>
                  <dl className="mt-1 space-y-0.5 text-xs">
                    <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Leads</dt><dd className="font-semibold tabular-nums text-slate-800">{formatNumber(d.leads)}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-teal-700">Won</dt><dd className="font-semibold tabular-nums text-teal-700">{formatNumber(d.won)}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-amber-700">Conversion</dt><dd className="font-semibold tabular-nums text-amber-700">{formatPercent(d.conversion_rate)}</dd></div>
                  </dl>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* x-axis labels */}
      <div className="mt-2 flex gap-2">
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center text-2xs text-slate-500">{monthLabel(d.month)}</span>
        ))}
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-reos-border pt-3 text-2xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" /> Leads</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-teal-600" /> Won</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded bg-[#b7791f]" /> Conversion rate</span>
      </div>
    </div>
  );
}

/**
 * Simple monthly-leads bar chart (used on the Analytics page) with hover values.
 */
export function MonthlyLeadsChart({ data }: { data: MonthlyLead[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) {
    return (
      <EmptyState
        title="No lead history"
        message="Monthly lead volume will appear here as inquiries accumulate."
      />
    );
  }
  const max = Math.max(1, ...data.map((d) => d.leads));
  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-2">
      {data.map((d, i) => (
        <div
          key={d.month}
          className="flex min-w-[44px] flex-1 flex-col items-center gap-1"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <span className={`text-2xs font-semibold transition ${hover === i ? 'text-teal-700' : 'text-slate-600'}`}>{formatNumber(d.leads)}</span>
          <div className="flex h-28 w-full items-end justify-center">
            <div
              className="w-6 rounded-t bg-gradient-to-t from-teal-700 to-teal-400 transition-all"
              style={{ height: `${(d.leads / max) * 100}%`, opacity: hover === null || hover === i ? 1 : 0.55 }}
            />
          </div>
          <span className="text-2xs text-slate-500">{monthLabel(d.month)}</span>
        </div>
      ))}
    </div>
  );
}
