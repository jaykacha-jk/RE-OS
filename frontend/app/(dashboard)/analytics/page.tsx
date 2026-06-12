'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  fetchDashboard,
  formatInr,
  formatNumber,
  formatPercent,
  type AnalyticsRange,
  type DashboardData,
} from '../../../lib/analytics';
import { getSession, hasPermission } from '../../../lib/auth';
import { KPICard, MetricCard } from '../../../components/analytics/kpi-card';
import { ChartCard, KpiSkeletonGrid } from '../../../components/analytics/chart-card';
import { RangeFilter } from '../../../components/analytics/range-filter';
import { FunnelChart } from '../../../components/analytics/funnel-chart';
import { LeadSourceChart } from '../../../components/analytics/lead-source-chart';
import { PropertyStatusChart } from '../../../components/analytics/property-status-chart';
import { ConversionChart, MonthlyLeadsChart } from '../../../components/analytics/conversion-chart';

export default function AnalyticsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAllowed(hasPermission(getSession(), 'analytics.read'));
  }, []);

  const load = useCallback(() => {
    if (range === 'custom' && (!from || !to)) return;
    setLoading(true);
    fetchDashboard(range, from, to)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e?.message ?? 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [range, from, to]);

  useEffect(load, [load]);

  if (allowed === false) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        You don’t have access to analytics. Ask your administrator for the <code>analytics.read</code> permission.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-600">
            Lead funnel, sources, property status and conversion trends.
          </p>
        </div>
        <RangeFilter
          range={range}
          from={from}
          to={to}
          onRangeChange={setRange}
          onFromChange={setFrom}
          onToChange={setTo}
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading || !data ? (
        <KpiSkeletonGrid count={4} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard label="Total leads" value={formatNumber(data.leads.total)} tone="teal" />
            <KPICard label="Qualified" value={formatNumber(data.leads.qualified)} tone="indigo" />
            <KPICard label="Won / Lost" value={`${data.leads.won} / ${data.leads.lost}`} tone="green" />
            <KPICard label="Conversion" value={formatPercent(data.leads.conversion_rate)} tone="amber" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Lead funnel" subtitle="New → Won">
              <FunnelChart steps={data.funnel} />
            </ChartCard>
            <ChartCard title="Lead sources" subtitle="Distribution by source">
              <LeadSourceChart sources={data.sources} />
            </ChartCard>
            <ChartCard title="Monthly leads" subtitle="Lead volume (last 6 months)">
              <MonthlyLeadsChart data={data.monthly_leads} />
            </ChartCard>
            <ChartCard title="Monthly conversion" subtitle="Leads vs. won">
              <ConversionChart data={data.monthly_conversion} />
            </ChartCard>
            <ChartCard title="Property status" subtitle="Inventory snapshot" className="lg:col-span-2">
              <div className="grid gap-4 lg:grid-cols-2">
                <PropertyStatusChart properties={data.properties} />
                <div className="grid grid-cols-2 gap-3 self-start sm:grid-cols-3">
                  <MetricCard label="Total" value={formatNumber(data.properties.total)} />
                  <MetricCard label="Active" value={formatNumber(data.properties.active)} />
                  <MetricCard label="Published" value={formatNumber(data.properties.published)} />
                  <MetricCard label="Reserved" value={formatNumber(data.properties.reserved)} />
                  <MetricCard label="Sold" value={formatNumber(data.properties.sold)} />
                  <MetricCard label="Revenue" value={formatInr(data.revenue.won_amount)} sub={`${data.revenue.won_deals} deals`} />
                </div>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
