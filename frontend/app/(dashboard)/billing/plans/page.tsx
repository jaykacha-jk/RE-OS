'use client';

import { useEffect, useState } from 'react';

import {
  changePlan,
  fetchPlans,
  fetchSubscription,
  formatLimit,
  formatMoney,
  formatStorage,
  subscribe,
  type BillingPlan,
  type BillingSubscription,
} from '../../../../lib/billing';

export default function BillingPlansPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [planRows, subscriptionRow] = await Promise.all([fetchPlans(), fetchSubscription()]);
    setPlans(planRows);
    setSubscription(subscriptionRow);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load plans'));
  }, []);

  async function choose(plan: BillingPlan) {
    setBusy(plan.code);
    setError(null);
    setMessage(null);
    try {
      if (subscription) {
        await changePlan(plan.code, cycle);
        setMessage(`Plan changed to ${plan.name}.`);
      } else {
        const result = await subscribe(plan.code, cycle);
        const checkout = result as { checkout?: { checkout_url?: string } };
        setMessage(checkout.checkout?.checkout_url ? `Checkout created: ${checkout.checkout.checkout_url}` : 'Subscription created.');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan change failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Plan comparison</h1>
          <p className="text-sm text-slate-500">Upgrade or downgrade based on properties, team size, and storage.</p>
        </div>
        <div className="rounded border bg-white p-1 text-sm">
          {(['monthly', 'yearly'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCycle(value)}
              className={`rounded px-3 py-1 capitalize ${cycle === value ? 'bg-teal-700 text-white' : 'text-slate-600'}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {message && <div className="rounded border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{message}</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = subscription?.plan.code === plan.code;
          const price = cycle === 'yearly' ? plan.yearly_price : plan.monthly_price;
          return (
            <div key={plan.id} className={`rounded-lg border bg-white p-5 ${isCurrent ? 'border-teal-500 ring-1 ring-teal-500' : ''}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">{plan.name}</h2>
                {isCurrent && <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">Current</span>}
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">{formatMoney(price)}</p>
              <p className="text-sm text-slate-500">{cycle === 'yearly' ? 'per year' : 'per month'}</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                <li>{formatLimit(plan.property_limit)} properties</li>
                <li>{formatLimit(plan.employee_limit)} employees</li>
                <li>{formatStorage(plan.storage_limit)} storage</li>
                <li>{plan.features.priority_support ? 'Priority support' : 'Standard support'}</li>
              </ul>
              <button
                type="button"
                disabled={busy === plan.code || isCurrent}
                onClick={() => choose(plan)}
                className="mt-6 w-full rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isCurrent ? 'Current plan' : busy === plan.code ? 'Updating...' : subscription ? 'Change plan' : 'Start subscription'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
