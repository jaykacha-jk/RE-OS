'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  fetchInvoices,
  fetchPlans,
  fetchSubscription,
  fetchUsage,
  formatLimit,
  formatMoney,
  formatStorage,
  type BillingPlan,
  type BillingSubscription,
  type BillingUsage,
  type Invoice,
} from '../../../lib/billing';

export default function BillingDashboardPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchPlans(), fetchSubscription(), fetchUsage(), fetchInvoices()])
      .then(([planRows, subscriptionRow, usageRow, invoiceRows]) => {
        setPlans(planRows);
        setSubscription(subscriptionRow);
        setUsage(usageRow);
        setInvoices(invoiceRows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load billing'));
  }, []);

  const currentPlan = subscription?.plan ?? usage?.plan;
  const paidInvoices = invoices.filter((invoice) => invoice.status === 'paid').length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-card">
        <div className="grid gap-6 bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 p-6 text-white lg:grid-cols-[1.5fr_1fr] lg:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">SaaS revenue center</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Billing</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
              Track plan value, renewal health, usage limits, invoices, and upgrade paths for a demo-ready subscription story.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-sm text-slate-200">Current commercial value</p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-white">{formatMoney(currentPlan?.monthly_price)}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-teal-100">
              {currentPlan?.name ?? 'No plan'} · {subscription?.status ?? 'not subscribed'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <Link className="inline-flex rounded-xl border border-white/20 px-4 py-2 font-bold text-white transition hover:bg-white/10" href="/billing/plans">
                Compare plans
              </Link>
              <Link className="inline-flex rounded-xl bg-white px-4 py-2 font-bold text-teal-900 shadow-card transition hover:bg-teal-50" href="/billing/subscription">
                Manage subscription
              </Link>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 shadow-sm">{error}</div>}

      <section className="grid gap-4 md:grid-cols-3">
        <BillingMetric label="Current plan" value={currentPlan?.name ?? 'No plan'}>
          <span className="capitalize">
            {subscription?.status ?? 'Not subscribed'} · {subscription?.billing_cycle ?? 'monthly'}
          </span>
        </BillingMetric>
        <BillingMetric label="MRR value" value={formatMoney(currentPlan?.monthly_price)}>
          Commercial subscription value
        </BillingMetric>
        <BillingMetric
          label="Renewal"
          value={subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('en-IN') : 'Pending'}
        >
            {subscription?.cancel_at_period_end ? 'Cancels at period end' : 'Auto renews'}
        </BillingMetric>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-reos-border bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Usage meters</h2>
              <p className="mt-1 text-xs text-slate-500">Plan limits that make upgrade value obvious.</p>
            </div>
            <Link className="text-sm font-bold text-teal-700 hover:underline" href="/billing/usage">
              View details
            </Link>
          </div>
          {usage ? (
            <div className="space-y-3 text-sm">
              <UsageRow label="Properties" used={usage.usage.properties} limit={usage.limits.properties} />
              <UsageRow label="Employees" used={usage.usage.employees} limit={usage.limits.employees} />
              <UsageRow label="AI minutes" used={usage.usage.ai_minutes} limit={usage.limits.ai_minutes} />
              <StorageRow used={usage.usage.storage_bytes} limit={usage.limits.storage_bytes} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading usage...</p>
          )}
        </div>

        <div className="rounded-2xl border border-reos-border bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Recent invoices</h2>
              <p className="mt-1 text-xs text-slate-500">{paidInvoices} paid invoices in this view.</p>
            </div>
            <Link className="text-sm font-bold text-teal-700 hover:underline" href="/billing/invoices">
              View all
            </Link>
          </div>
          {invoices.length ? (
            <div className="space-y-3 text-sm">
              {invoices.slice(0, 4).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-bold text-slate-800">{invoice.invoice_number}</p>
                    <p className="text-xs text-slate-500">{new Date(invoice.issued_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums text-slate-900">{formatMoney(invoice.total)}</p>
                    <p className="text-xs capitalize text-slate-500">{invoice.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No invoices yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-reos-border bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Available plans</h2>
            <p className="mt-1 text-xs text-slate-500">Pricing cards for upgrade conversations and investor demos.</p>
          </div>
          <Link href="/billing/plans" className="text-sm font-bold text-teal-700 hover:underline">Full comparison</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className={`rounded-2xl border p-5 shadow-sm ${currentPlan?.id === plan.id ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-bold text-slate-900">{plan.name}</p>
                {currentPlan?.id === plan.id ? <span className="rounded-full bg-teal-700 px-2.5 py-1 text-xs font-bold text-white">Current</span> : null}
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight text-teal-800">{formatMoney(plan.monthly_price)}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {formatLimit(plan.property_limit)} properties · {formatLimit(plan.employee_limit)} employees ·{' '}
                {formatStorage(plan.storage_limit)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function BillingMetric({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-reos-border bg-gradient-to-br from-white to-slate-50 p-5 shadow-card">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{children}</p>
    </div>
  );
}

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const displayLimit = formatLimit(limit);
  const pct = limit >= 2147483647 ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div>
      <div className="mb-2 flex justify-between">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900">
          {used.toLocaleString('en-IN')} / {displayLimit}
        </span>
      </div>
      {limit < 2147483647 && (
        <div className="h-2.5 rounded-full bg-slate-100">
          <div className="h-2.5 rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function StorageRow({ used, limit }: { used: number; limit: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-600">Storage</span>
        <span className="font-semibold tabular-nums text-slate-900">
          {formatStorage(used)} / {formatStorage(limit)}
        </span>
      </div>
    </div>
  );
}
