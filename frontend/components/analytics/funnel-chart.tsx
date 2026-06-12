'use client';

import { useState } from 'react';

import type { FunnelStep } from '../../lib/analytics';
import { formatNumber } from '../../lib/analytics';
import { EmptyState } from './chart-card';

/**
 * Horizontal lead funnel: New → Contacted → Qualified → Visit → Negotiation → Won.
 * Bar width is proportional to the top-of-funnel count; per-step conversion and
 * absolute drop-off are revealed on hover.
 */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = steps.length ? steps[0].count : 0;
  if (!max) {
    return (
      <EmptyState
        title="No leads in this period"
        message="Once inquiries start flowing in, the funnel will show how leads progress from New to Won."
      />
    );
  }

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const pct = max ? (step.count / max) * 100 : 0;
        const prev = i > 0 ? steps[i - 1].count : step.count;
        const stepConv = prev ? Math.round((step.count / prev) * 100) : 100;
        const dropOff = Math.max(0, prev - step.count);
        return (
          <div
            key={step.key}
            className="group relative flex items-center gap-3"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="w-24 shrink-0 text-xs font-medium text-slate-600">{step.label}</div>
            <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-slate-100">
              <div
                className="flex h-full items-center justify-end rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 px-2 text-2xs font-semibold text-white transition-all"
                style={{ width: `${Math.max(pct, 6)}%` }}
              >
                {formatNumber(step.count)}
              </div>
              {hover === i && i > 0 ? (
                <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2 translate-x-full rounded-lg border border-reos-border bg-white px-2.5 py-1.5 text-2xs shadow-dropdown">
                  <span className="font-semibold text-slate-800">{stepConv}% kept</span>
                  {dropOff > 0 ? <span className="text-rose-600"> · {formatNumber(dropOff)} dropped</span> : null}
                </div>
              ) : null}
            </div>
            <div className="w-12 shrink-0 text-right text-2xs text-slate-400">
              {i === 0 ? '' : `${stepConv}%`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
