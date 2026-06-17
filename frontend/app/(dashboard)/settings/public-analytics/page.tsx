'use client';

import { useEffect, useState } from 'react';

import { fetchPublicAnalytics, type PublicAnalytics } from '../../../../lib/settings';
import { isUuid } from '../../../../lib/phone';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">
        {value.toLocaleString('en-IN')}
        {suffix ? <span className="text-base text-slate-500">{suffix}</span> : null}
      </p>
    </div>
  );
}

export default function PublicAnalyticsPage() {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState<PublicAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchPublicAnalytics(range)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Public analytics</h1>
          <p className="mt-1 text-sm text-slate-600">Website traffic, engagement and conversions.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={`rounded px-3 py-1 text-sm ${
                range === r.value ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="mt-6 text-slate-500">Loading…</p> : null}

      {data && !loading ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Page views" value={data.totals.page_views} />
            <Stat label="Property views" value={data.totals.property_views} />
            <Stat label="Property clicks" value={data.totals.property_clicks} />
            <Stat label="Inquiries" value={data.totals.inquiry_conversions} />
            <Stat label="Chat conversions" value={data.totals.chat_conversions} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Stat label="Inquiry conversion" value={data.conversion.inquiry_conversion_rate} suffix="%" />
            <Stat label="Chat conversion" value={data.conversion.chat_conversion_rate} suffix="%" />
            <Stat label="Click-through rate" value={data.conversion.click_through_rate} suffix="%" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ListCard title="Top pages" rows={data.top_pages.map((p) => ({ label: p.path ?? '—', value: p.views }))} />
            <ListCard
              title="Traffic sources"
              rows={data.traffic_sources.map((s) => ({ label: s.source, value: s.count }))}
            />
            <ListCard
              title="Top properties"
              rows={data.top_properties.map((p, index) => ({
                label: p.entity_id && !isUuid(p.entity_id) ? p.entity_id : `Property ${index + 1}`,
                value: p.views,
              }))}
            />
            <ListCard
              title="Referrers"
              rows={data.referrers.map((r) => ({ label: r.referrer ?? 'direct', value: r.count }))}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ListCard({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  return (
    <div className="rounded-lg border border-slate-200">
      <p className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-900">{title}</p>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No data yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="truncate pr-4 text-slate-600">{row.label}</span>
              <span className="font-medium text-slate-900">{row.value.toLocaleString('en-IN')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
