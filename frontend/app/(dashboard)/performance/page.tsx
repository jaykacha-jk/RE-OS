'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  fetchEmployeePerformance,
  formatNumber,
  formatPercent,
  type AnalyticsRange,
  type EmployeePerformance,
} from '../../../lib/analytics';
import { getSession, hasAnyRole } from '../../../lib/auth';
import { KPICard } from '../../../components/analytics/kpi-card';
import { ChartCard, KpiSkeletonGrid } from '../../../components/analytics/chart-card';
import { RangeFilter } from '../../../components/analytics/range-filter';
import { EmployeePerformanceTable } from '../../../components/analytics/employee-performance-table';

const PERFORMANCE_ROLES = [
  'super_admin',
  'org_owner',
  'org_admin',
  'marketing_user',
  'sales_manager',
];

export default function PerformancePage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<EmployeePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAllowed(hasAnyRole(getSession(), PERFORMANCE_ROLES));
  }, []);

  const load = useCallback(() => {
    if (range === 'custom' && (!from || !to)) return;
    setLoading(true);
    fetchEmployeePerformance(range, from, to)
      .then((d) => {
        setRows(d.employees);
        setError(null);
      })
      .catch((e) => setError(e?.message ?? 'Failed to load performance'))
      .finally(() => setLoading(false));
  }, [range, from, to]);

  useEffect(load, [load]);

  if (allowed === false) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Team performance is available to owners, admins and managers.
      </div>
    );
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.leads += r.leads;
      acc.won += r.won;
      acc.visits += r.site_visits;
      return acc;
    },
    { leads: 0, won: 0, visits: 0 },
  );
  const teamConversion = totals.leads ? (totals.won / totals.leads) * 100 : 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Team performance</h1>
          <p className="mt-1 text-sm text-slate-600">
            Leads, site visits, conversions and won deals per team member.
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

      {loading ? (
        <KpiSkeletonGrid count={4} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard label="Team members" value={formatNumber(rows.length)} tone="teal" />
            <KPICard label="Total leads" value={formatNumber(totals.leads)} />
            <KPICard label="Won deals" value={formatNumber(totals.won)} tone="green" />
            <KPICard label="Team conversion" value={formatPercent(teamConversion)} tone="amber" />
          </div>

          <div className="mt-6">
            <ChartCard title="Leaderboard" subtitle="Ranked by won deals">
              <EmployeePerformanceTable rows={rows} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
