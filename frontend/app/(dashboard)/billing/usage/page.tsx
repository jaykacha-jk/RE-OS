'use client';

import { useEffect, useState } from 'react';

import {
  fetchUsage,
  formatLimit,
  formatStorage,
  type BillingUsage,
} from '../../../../lib/billing';

export default function UsagePage() {
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsage()
      .then(setUsage)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load usage'));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Usage</h1>
        <p className="text-sm text-slate-500">Current usage against plan limits. Creation APIs enforce these limits.</p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {usage ? (
        <div className="grid gap-4 md:grid-cols-2">
          <UsageCard label="Properties" used={usage.usage.properties} limit={usage.limits.properties} />
          <UsageCard label="Employees" used={usage.usage.employees} limit={usage.limits.employees} />
          <UsageCard
            label="Storage"
            used={usage.usage.storage_bytes}
            limit={usage.limits.storage_bytes}
            formatter={formatStorage}
          />
          <UsageCard label="AI minutes" used={usage.usage.ai_minutes} limit={usage.limits.ai_minutes} />
        </div>
      ) : (
        <p className="text-sm text-slate-500">Loading usage...</p>
      )}
    </div>
  );
}

function UsageCard({
  label,
  used,
  limit,
  formatter,
}: {
  label: string;
  used: number;
  limit: number;
  formatter?: (value: number) => string;
}) {
  const unlimited = limit >= 2147483647 || limit === 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const format = formatter ?? ((value: number) => formatLimit(value));

  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{label}</h2>
        <span className="text-sm text-slate-500">
          {format(used)} / {unlimited ? 'Unlimited' : format(limit)}
        </span>
      </div>
      {!unlimited && (
        <div className="mt-4">
          <div className="h-3 rounded-full bg-slate-100">
            <div className="h-3 rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{pct}% used</p>
        </div>
      )}
    </div>
  );
}
