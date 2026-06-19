'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { KPICard } from '../../../../components/analytics/kpi-card';
import { ChartCard, EmptyState } from '../../../../components/analytics/chart-card';
import { Icon, PageHeader } from '../../../../components/ui';
import { formatMoney } from '../../../../lib/billing';
import { fetchPlatformBillingMetrics, type PlatformBillingMetrics } from '../../../../lib/platform-billing';

export default function PlatformBillingPage() {
  const [data, setData] = useState<PlatformBillingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlatformBillingMetrics()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load billing metrics'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Billing & revenue"
        description="Subscription health, MRR/ARR, and invoice metrics across all tenants."
        actions={
          <Link href="/platform/plans" className="btn-secondary">
            <Icon name="billing" className="h-4 w-4" /> Manage plans
          </Link>
        }
      />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {loading || !data ? (
        <p className="text-sm text-slate-500">Loading billing metrics…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              label="MRR"
              value={formatMoney(data.mrr)}
              tone="green"
              icon={<Icon name="billing" />}
              hint={`ARR ${formatMoney(data.arr)}`}
            />
            <KPICard
              label="Paid revenue"
              value={formatMoney(data.paid_revenue)}
              tone="teal"
              icon={<Icon name="performance" />}
            />
            <KPICard
              label="Active subscriptions"
              value={String(data.subscription_health.active)}
              icon={<Icon name="organizations" />}
              hint={`${data.subscription_health.past_due} past due`}
            />
            <KPICard
              label="Churn rate"
              value={`${data.churn.churn_rate}%`}
              tone={data.churn.churn_rate > 5 ? 'rose' : 'default'}
              icon={<Icon name="pulse" />}
              hint={`${data.churn.cancelled_subscriptions} cancelled`}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Subscription health" subtitle="Current subscription states">
              <ul className="space-y-3 text-sm">
                {[
                  ['Active / trial', data.subscription_health.active, 'text-teal-700'],
                  ['Past due', data.subscription_health.past_due, 'text-amber-700'],
                  ['Suspended', data.subscription_health.suspended, 'text-rose-700'],
                  ['Cancelled', data.subscription_health.cancelled, 'text-slate-600'],
                ].map(([label, value, tone]) => (
                  <li key={String(label)} className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-600">{label}</span>
                    <span className={`font-semibold tabular-nums ${tone}`}>{value}</span>
                  </li>
                ))}
              </ul>
            </ChartCard>

            <ChartCard title="Invoices" subtitle="Platform-wide invoice outcomes">
              <ul className="space-y-3 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Total issued</span>
                  <span className="font-semibold tabular-nums">{data.invoices.total}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Paid</span>
                  <span className="font-semibold tabular-nums text-teal-700">{data.invoices.paid}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Failed</span>
                  <span className="font-semibold tabular-nums text-rose-700">{data.invoices.failed}</span>
                </li>
              </ul>
            </ChartCard>

            <ChartCard title="Plan distribution" subtitle="Subscriptions by plan code" className="lg:col-span-2">
              {data.plan_distribution.length ? (
                <ul className="space-y-2.5">
                  {data.plan_distribution.map((row) => {
                    const total = data.plan_distribution.reduce((sum, p) => sum + p.count, 0);
                    const pct = total ? (row.count / total) * 100 : 0;
                    return (
                      <li key={row.plan_code} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-slate-600">{row.plan_code}</span>
                          <span className="font-semibold tabular-nums text-slate-800">{row.count}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-teal-500"
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState title="No subscriptions yet" message="Plans will appear here once tenants subscribe." />
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
