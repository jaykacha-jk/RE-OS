'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { fetchAiDashboard, type AiDashboard } from '../../../lib/ai';
import { getSession, hasPermission } from '../../../lib/auth';

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const QUICK_ACTIONS = [
  {
    href: '/ai/playground',
    label: 'Open assistant workbench (rules + LLM chat)',
    permission: 'ai.qualify',
  },
  {
    href: '/ai/calls',
    label: 'View demo call logs & transcripts',
    permission: 'ai.calls.read',
  },
  {
    href: '/ai/knowledge',
    label: 'View knowledge base',
    permission: 'ai.knowledge.read',
  },
  {
    href: '/ai/settings',
    label: 'Configure assistant settings & provider',
    permission: 'ai.settings.read',
  },
];

export default function AiDashboardPage() {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState<AiDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quickActions, setQuickActions] = useState<typeof QUICK_ACTIONS>([]);

  useEffect(() => {
    const session = getSession();
    setQuickActions(QUICK_ACTIONS.filter((action) => hasPermission(session, action.permission)));
    fetchAiDashboard(range)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load AI dashboard'));
  }, [range]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Assistant automation</h1>
          <p className="text-sm text-slate-500">
            LLM-backed chat when OpenAI is configured, plus deterministic qualification, matching, and follow-up rules.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={`rounded border px-3 py-2 ${
                range === r.value ? 'border-teal-600 bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Metric label="Assistant conversations" value={data?.ai_conversations} />
        <Metric label="Assistant conversions" value={data?.ai_conversions} />
        <Metric label="Demo voice calls" value={data?.calls_total} sub={`${data?.calls_completed ?? 0} completed`} />
        <Metric label="Qualified calls" value={data?.qualified_calls} />
        <Metric label="Qualification rate" value={data ? `${data.qualification_rate}%` : undefined} />
        <Metric label="Conversion rate" value={data ? `${data.conversion_rate}%` : undefined} />
        <Metric label="Handoff rate" value={data ? `${data.handoff_rate}%` : undefined} />
        <Metric label="Knowledge docs" value={data?.knowledge_documents} />
        <Metric label="Total tokens" value={data?.total_tokens?.toLocaleString('en-IN')} />
        <Metric label="Est. cost" value={data ? `$${data.estimated_cost_usd}` : undefined} />
        <Metric label="Cost / lead" value={data ? `$${data.cost_per_lead_usd}` : undefined} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-4 font-semibold text-slate-900">Lead temperature (demo calls)</h2>
          {data?.temperature_breakdown.length ? (
            <div className="space-y-2 text-sm">
              {data.temperature_breakdown.map((t) => (
                <div key={t.temperature ?? 'unknown'} className="flex items-center justify-between">
                  <span className="capitalize text-slate-600">{t.temperature ?? 'unknown'}</span>
                  <span className="font-semibold text-slate-900">{t.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No qualified calls yet.</p>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-4 font-semibold text-slate-900">Quick actions</h2>
          <div className="grid gap-2 text-sm">
            {quickActions.map((action) => (
              <Link key={action.href} className="rounded border px-3 py-2 text-slate-700 hover:bg-slate-50" href={action.href}>
                {action.label}
              </Link>
            ))}
            {!quickActions.length && (
              <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">
                No AI actions are available for your role.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value?: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
