'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  cancelSubscription,
  fetchSubscription,
  formatMoney,
  type BillingSubscription,
} from '../../../../lib/billing';

const STATUS_TONE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  trial: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  past_due: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  suspended: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

function statusTone(status: string): string {
  return STATUS_TONE[status] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setSubscription(await fetchSubscription());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancel() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await cancelSubscription(true);
      setSubscription(updated);
      setMessage('Subscription will cancel at the end of the current period.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Billing</p>
        <h1 className="page-title">Subscription</h1>
        <p className="page-subtitle">Review status, renewal timeline, and cancellation settings for this organization.</p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <section className="panel space-y-4 p-6">
          <div className="h-4 w-28 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-9 w-48 animate-pulse rounded-xl bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </section>
      ) : subscription ? (
        <section className="panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Current plan</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{subscription.plan.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {formatMoney(subscription.plan.monthly_price)} / month · {subscription.billing_cycle}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusTone(subscription.status)}`}>
              {subscription.status.replace(/_/g, ' ')}
            </span>
          </div>

          {subscription.cancel_at_period_end ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
              Cancellation is scheduled for the end of the current billing period.
            </div>
          ) : null}

          <dl className="mt-6 grid gap-4 text-sm md:grid-cols-3">
            <div className="rounded-xl border border-reos-border bg-reos-muted/60 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Period start</dt>
              <dd className="mt-1 font-semibold tabular-nums text-slate-900">
                {subscription.current_period_start
                  ? new Date(subscription.current_period_start).toLocaleDateString('en-IN')
                  : 'Pending'}
              </dd>
            </div>
            <div className="rounded-xl border border-reos-border bg-reos-muted/60 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Renews / ends</dt>
              <dd className="mt-1 font-semibold tabular-nums text-slate-900">
                {subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString('en-IN')
                  : 'Pending'}
              </dd>
            </div>
            <div className="rounded-xl border border-reos-border bg-reos-muted/60 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Trial ends</dt>
              <dd className="mt-1 font-semibold tabular-nums text-slate-900">
                {subscription.trial_ends_at
                  ? new Date(subscription.trial_ends_at).toLocaleDateString('en-IN')
                  : 'No trial'}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/billing/plans" className="btn-primary">
              Change plan
            </Link>
            <button
              type="button"
              onClick={cancel}
              disabled={busy || subscription.cancel_at_period_end}
              className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {subscription.cancel_at_period_end ? 'Cancellation scheduled' : busy ? 'Cancelling…' : 'Cancel at period end'}
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-teal-200 bg-gradient-to-br from-teal-50 to-white p-10 text-center shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">No active subscription</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Activate billing for this organization.</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
            Choose a plan to unlock quota tracking, usage meters, and invoices.
          </p>
          <Link href="/billing/plans" className="btn-primary mt-6">
            Choose a plan
          </Link>
        </section>
      )}
    </div>
  );
}
