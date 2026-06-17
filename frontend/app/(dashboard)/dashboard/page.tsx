'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  fetchDashboard,
  fetchPlatformDashboard,
  formatInr,
  formatNumber,
  formatPercent,
  type AnalyticsRange,
  type DashboardData,
  type PlatformDashboardData,
} from '../../../lib/analytics';
import { getSession, hasPermission, isSuperAdmin, type AuthSession } from '../../../lib/auth';
import { KPICard } from '../../../components/analytics/kpi-card';
import { ChartCard, EmptyState, KpiSkeletonGrid } from '../../../components/analytics/chart-card';
import { RangeFilter } from '../../../components/analytics/range-filter';
import { FunnelChart } from '../../../components/analytics/funnel-chart';
import { LeadSourceChart } from '../../../components/analytics/lead-source-chart';
import { PropertyStatusChart } from '../../../components/analytics/property-status-chart';
import { ConversionChart, MonthlyLeadsChart } from '../../../components/analytics/conversion-chart';
import { EmployeePerformanceTable } from '../../../components/analytics/employee-performance-table';
import { ActivityFeed } from '../../../components/analytics/activity-feed';
import { SystemHealth, type HealthRow } from '../../../components/analytics/system-health';
import { Icon, type IconName } from '../../../components/ui/icons';

export default function DashboardPage() {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  if (!session) return null;
  return isSuperAdmin(session) ? (
    <PlatformDashboard session={session} />
  ) : (
    <OrgDashboard session={session} />
  );
}

// ===========================================================================
// Super Admin — platform-wide dashboard
// ===========================================================================

function PlatformDashboard({ session }: { session: AuthSession }) {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchPlatformDashboard(range)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(load, [load]);

  const healthRows: HealthRow[] = data
    ? [
        { label: 'Billing engine', detail: `${formatInr(data.revenue.mrr)} MRR tracked`, status: data.organizations.past_due ? 'warn' : 'ok', icon: 'billing' },
        { label: 'Tenant health', detail: `${formatPercent(data.platform_health.active_ratio)} active`, status: data.platform_health.status === 'at_risk' ? 'warn' : 'ok', icon: 'organizations' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Header
        title="Platform overview"
        subtitle={`Welcome${session.user.first_name ? `, ${session.user.first_name}` : ''}. Cross-tenant metrics across RE-OS.`}
        eyebrow="Platform command center"
        range={range}
        onRange={setRange}
      />

      {error ? <ErrorBanner message={error} /> : null}

      {loading || !data ? (
        <KpiSkeletonGrid count={4} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard label="Organizations" value={formatNumber(data.organizations.total)} tone="teal" icon={<Icon name="organizations" />} hint={`${data.organizations.active} active · ${data.organizations.trial} trial`} />
            <KPICard label="MRR" value={formatInr(data.revenue.mrr)} tone="green" icon={<Icon name="billing" />} hint={`ARR ${formatInr(data.revenue.arr)}`} />
            <KPICard label="Total users" value={formatNumber(data.totals.users)} tone="indigo" icon={<Icon name="employees" />} />
            <KPICard label="Platform health" value={titleCase(data.platform_health.status)} tone={data.platform_health.status === 'at_risk' ? 'rose' : 'teal'} icon={<Icon name="pulse" />} hint={`${formatPercent(data.platform_health.active_ratio)} active`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-8">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard label="Total properties" value={formatNumber(data.totals.properties)} icon={<Icon name="properties" />} />
                <KPICard label="Total leads" value={formatNumber(data.totals.leads)} icon={<Icon name="inquiries" />} />
                <KPICard label="Suspended" value={formatNumber(data.organizations.suspended)} tone={data.organizations.suspended ? 'amber' : 'default'} />
                <KPICard label="Past due" value={formatNumber(data.organizations.past_due)} tone={data.organizations.past_due ? 'rose' : 'default'} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Organization growth" subtitle="New organizations per month">
                  <MonthlyLeadsChart data={data.monthly_growth.map((g) => ({ month: g.month, leads: g.organizations }))} />
                </ChartCard>
                <ChartCard title="Plan tier distribution" subtitle="Paying & trial organizations by tier">
                  {data.tier_breakdown.length ? (
                    <ul className="space-y-2.5">
                      {data.tier_breakdown.map((t) => {
                        const pct = data.organizations.total ? (t.count / data.organizations.total) * 100 : 0;
                        return (
                          <li key={t.tier} className="text-sm">
                            <div className="flex items-center justify-between">
                              <span className="capitalize text-slate-600">{t.tier}</span>
                              <span className="font-semibold tabular-nums text-slate-800">{formatNumber(t.count)}</span>
                            </div>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.max(pct, 3)}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <EmptyState title="No organizations yet" message="Create your first organization from Platform → Organizations." />
                  )}
                </ChartCard>
              </div>
            </div>

            <aside className="space-y-5 lg:col-span-4">
              <PlatformBrief data={data} />
              <SystemHealth rows={healthRows} updatedAt={data.generated_at} />
              <ActivityFeed />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

// ===========================================================================
// Organization / Employee dashboard
// ===========================================================================

function OrgDashboard({ session }: { session: AuthSession }) {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchDashboard(range)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(load, [load]);

  const scopeLabel =
    data?.scope === 'all' ? 'Organization' : data?.scope === 'team' ? 'My team' : 'My';

  const healthRows: HealthRow[] = data
    ? [
        { label: 'CRM pipeline', detail: `${formatNumber(data.leads.qualified)} qualified in motion`, status: data.leads.total ? 'ok' : 'warn', icon: 'inquiries' },
        { label: 'Inventory', detail: `${formatNumber(data.properties.published)} published listings`, status: data.properties.published ? 'ok' : 'warn', icon: 'properties' },
        { label: 'Conversion', detail: `${formatPercent(data.leads.conversion_rate)} lead → won`, status: data.leads.conversion_rate >= 10 ? 'ok' : 'warn', icon: 'performance' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Header
        title="Dashboard"
        subtitle={`Welcome${session.user.first_name ? `, ${session.user.first_name}` : ''}. ${data ? `${scopeLabel} performance at a glance.` : ''}`}
        eyebrow="Workspace command center"
        range={range}
        onRange={setRange}
      />

      {error ? <ErrorBanner message={error} /> : null}

      {loading || !data ? (
        <KpiSkeletonGrid count={4} />
      ) : (
        <>
          {/* Primary KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard label="Total leads" value={formatNumber(data.leads.total)} tone="teal" icon={<Icon name="inquiries" />} hint={`${formatNumber(data.leads.new)} new`} />
            <KPICard label="Qualified" value={formatNumber(data.leads.qualified)} tone="indigo" icon={<Icon name="check" />} hint={`${formatNumber(data.leads.site_visits)} site visits`} />
            <KPICard label="Won deals" value={formatNumber(data.leads.won)} tone="green" icon={<Icon name="performance" />} hint={`${formatNumber(data.leads.lost)} lost`} />
            <KPICard label="Conversion" value={formatPercent(data.leads.conversion_rate)} tone="amber" icon={<Icon name="analytics" />} hint={`${formatInr(data.revenue.received_commission)} received`} />
          </div>

          {data.scope !== 'assigned' ? <LaunchReadiness data={data} session={session} /> : null}

          <div className="grid gap-5 lg:grid-cols-12">
            {/* Main column */}
            <div className="space-y-5 lg:col-span-8">
              {/* Inventory KPI strip */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard label="Properties" value={formatNumber(data.properties.total)} icon={<Icon name="properties" />} />
                <KPICard label="Active" value={formatNumber(data.properties.active)} hint={`${formatNumber(data.properties.published)} published`} />
                <KPICard label="Reserved" value={formatNumber(data.properties.reserved)} />
                <KPICard label="Sold" value={formatNumber(data.properties.sold)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ChartCard title="Lead funnel" subtitle="New → Won (conversion per step)">
                  <FunnelChart steps={data.funnel} />
                </ChartCard>
                <ChartCard title="Lead sources" subtitle="Where your leads come from">
                  <LeadSourceChart sources={data.sources} />
                </ChartCard>
                <ChartCard title="Property status" subtitle="Inventory snapshot">
                  <PropertyStatusChart properties={data.properties} />
                </ChartCard>
                <ChartCard title="Monthly conversion" subtitle="Leads vs. won (last 6 months)">
                  <ConversionChart data={data.monthly_conversion} />
                </ChartCard>
              </div>

              {data.scope !== 'assigned' ? (
                <ChartCard
                  title="Team performance"
                  subtitle="Top performers by won deals"
                  action={
                    <Link href="/performance" className="text-2xs font-semibold text-teal-700 hover:underline">
                      View all
                    </Link>
                  }
                >
                  <EmployeePerformanceTable rows={data.employees.slice(0, 5)} />
                </ChartCard>
              ) : null}
            </div>

            {/* Right rail */}
            <aside className="space-y-5 lg:col-span-4">
              <LeadDiscipline data={data} />
              <QuickActions session={session} />
              <ActivityFeed />
              <SystemHealth rows={healthRows} updatedAt={data.generated_at} />
            </aside>
          </div>

          <div className="flex items-center justify-between text-2xs text-slate-400">
            <Link href="/analytics" className="font-semibold text-teal-700 hover:underline">
              Open full analytics →
            </Link>
            <span>Updated {new Date(data.generated_at).toLocaleString('en-IN')}</span>
          </div>
        </>
      )}
    </div>
  );
}

function isLaunchMode(): boolean {
  return process.env.NEXT_PUBLIC_REOS_LAUNCH_MODE !== 'false';
}

// ===========================================================================
// Shared bits
// ===========================================================================

function Header({
  title,
  subtitle,
  eyebrow,
  range,
  onRange,
}: {
  title: string;
  subtitle: string;
  eyebrow: string;
  range: AnalyticsRange;
  onRange: (r: AnalyticsRange) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-teal-900/20 bg-gradient-to-br from-teal-900 via-slate-900 to-slate-950 shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-4 p-5 text-white sm:p-6">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.2em] text-teal-200">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-300">{subtitle}</p>
        </div>
        <div className="rounded-xl bg-white/10 p-1.5 backdrop-blur">
          <RangeFilter
            range={range}
            from=""
            to=""
            onRangeChange={onRange}
            onFromChange={() => undefined}
            onToChange={() => undefined}
          />
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
      <span className="font-semibold">Could not load dashboard.</span> {message}
    </div>
  );
}

function PlatformBrief({ data }: { data: PlatformDashboardData }) {
  return (
    <section className="card overflow-hidden">
      <div className="bg-gradient-to-br from-teal-50 to-white p-5">
        <p className="eyebrow">Platform health</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{formatInr(data.revenue.arr)} ARR</h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-600">
          Across {formatNumber(data.organizations.total)} organizations · {formatPercent(data.platform_health.active_ratio)} active.
        </p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-reos-border border-t border-reos-border">
        <BriefStat label="Active tenants" value={formatNumber(data.organizations.active)} detail={`${formatNumber(data.organizations.trial)} trials`} />
        <BriefStat label="CRM leads" value={formatNumber(data.totals.leads)} detail="captured by tenants" />
      </div>
    </section>
  );
}

function BriefStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="p-4">
      <p className="text-overline">{label}</p>
      <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-teal-800">{value}</p>
      <p className="mt-0.5 text-2xs text-slate-500">{detail}</p>
    </div>
  );
}

type QuickAction = { href: string; label: string; helper: string; icon: IconName; show: boolean };

function QuickActions({ session }: { session: AuthSession }) {
  const actions: QuickAction[] = ([

    {
      href: '/properties/new',
      label: 'Add property',
      helper: 'Publish inventory for website & CRM',
      icon: 'properties',
      show: hasPermission(session, 'properties.create'),
    },
    {
      href: '/inquiries/new',
      label: 'New inquiry',
      helper: 'Capture walk-in, referral or phone leads',
      icon: 'inquiries',
      show: hasPermission(session, 'crm.inquiries.create'),
    },
    {
      href: '/pipeline',
      label: 'Open pipeline',
      helper: 'Move qualified leads to site visits',
      icon: 'pipeline',
      show: hasPermission(session, 'crm.inquiries.read'),
    },
    {
      href: '/chat',
      label: 'Live chat',
      helper: 'Respond to website & WhatsApp visitors',
      icon: 'chat',
      show: !isLaunchMode() && hasPermission(session, 'chat.conversations.read'),
    },
  ] as QuickAction[]).filter((action) => action.show);

  if (!actions.length) return null;

  return (
    <section className="card p-5">
      <header className="mb-4">
        <h3 className="text-h3">Quick actions</h3>
        <p className="text-caption mt-1">Jump straight into daily sales work</p>
      </header>
      <div className="grid gap-2.5">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex items-center gap-3 rounded-xl border border-reos-border bg-white p-3 transition hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/50 hover:shadow-card"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <Icon name={action.icon} className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-800">{action.label}</span>
              <span className="block truncate text-2xs text-slate-500">{action.helper}</span>
            </span>
            <Icon name="arrowUpRight" className="h-4 w-4 text-slate-300 transition group-hover:text-teal-500" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function LaunchReadiness({ data, session }: { data: DashboardData; session: AuthSession }) {
  const items = [
    {
      label: 'Publish 5 properties',
      done: data.properties.published >= 5,
      progress: `${formatNumber(data.properties.published)} / 5 published`,
      href: '/properties',
      show: hasPermission(session, 'properties.read'),
    },
    {
      label: 'Invite 2 team members',
      done: data.team_size >= 2,
      progress: `${formatNumber(data.team_size)} team members`,
      href: '/employees',
      show: hasPermission(session, 'employees.read'),
    },
    {
      label: 'Complete Website Setup',
      done: data.properties.published > 0,
      progress: data.properties.published > 0 ? 'Public website has inventory' : 'Add brand, contact and SEO basics',
      href: '/settings/website',
      show: hasPermission(session, 'settings.website.manage'),
    },
    {
      label: 'Capture first lead',
      done: data.leads.total > 0,
      progress: `${formatNumber(data.leads.total)} leads captured`,
      href: '/inquiries',
      show: hasPermission(session, 'crm.inquiries.read'),
    },
    {
      label: 'Assign first lead',
      done: data.leads.total > 0 && data.sla.unassigned_leads === 0,
      progress: data.leads.total > 0 ? `${formatNumber(data.sla.unassigned_leads)} unassigned leads` : 'Capture a lead first',
      href: '/inquiries',
      show: hasPermission(session, 'crm.inquiries.read'),
    },
    {
      label: 'Close first win',
      done: data.leads.won > 0,
      progress: `${formatNumber(data.leads.won)} won deals`,
      href: '/pipeline',
      show: hasPermission(session, 'crm.inquiries.read'),
    },
  ].filter((item) => item.show);

  if (!items.length) return null;
  const completed = items.filter((item) => item.done).length;

  return (
    <section className="rounded-3xl border border-teal-100 bg-gradient-to-br from-white to-teal-50 p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-teal-700">Launch activation</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">Get the agency to first value</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            First customers should reach a working sales loop before seeing advanced platform controls.
          </p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-2xs font-bold uppercase tracking-[0.16em] text-slate-500">Progress</p>
          <p className="mt-1 text-2xl font-bold text-teal-800">{completed}/{items.length}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-2xl border border-white/80 bg-white p-4 transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-card"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-900">{item.label}</p>
              <span className={`rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wide ${item.done ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                {item.done ? 'Done' : 'Next'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{item.progress}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function LeadDiscipline({ data }: { data: DashboardData }) {
  const atRisk = data.sla.stale_new_leads + data.sla.unassigned_leads + data.sla.overdue_followups + data.sla.missed_followups;
  const needsAttention = atRisk > 0 || data.sla.due_today_followups > 0;
  return (
    <section className={`card overflow-hidden ${atRisk ? 'border-rose-200' : needsAttention ? 'border-amber-200' : ''}`}>
      <div className="p-5">
        <p className="eyebrow">SLA discipline</p>
        <h3 className="mt-2 text-lg font-bold tracking-tight text-slate-950">
          {atRisk ? 'Leads need attention now' : needsAttention ? 'Follow-ups due today' : 'No stale lead work'}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Launch retention depends on a simple rule: contact every new lead within 24 hours and never let scheduled follow-ups slip.
        </p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-reos-border border-t border-reos-border">
        <BriefStat label="Unassigned" value={formatNumber(data.sla.unassigned_leads)} detail="needs owner" />
        <BriefStat label="Stale new" value={formatNumber(data.sla.stale_new_leads)} detail="24h+ untouched" />
        <BriefStat label="Due today" value={formatNumber(data.sla.due_today_followups)} detail="pending follow-ups" />
        <BriefStat label="Overdue" value={formatNumber(data.sla.overdue_followups)} detail="pending past date" />
        <BriefStat label="Missed" value={formatNumber(data.sla.missed_followups)} detail="marked missed" />
      </div>
      <div className="border-t border-reos-border bg-slate-50 px-5 py-3">
        <Link href="/inquiries" className="text-sm font-semibold text-teal-700 hover:underline">
          Review lead follow-up queue →
        </Link>
      </div>
    </section>
  );
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
