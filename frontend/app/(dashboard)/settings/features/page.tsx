'use client';

import { useEffect, useState } from 'react';

import { fetchFeatures, updateFeatures, type FeatureFlags } from '../../../../lib/settings';

const LABELS: Record<string, string> = {
  chat: 'Live chat',
  ai: 'Assistant automation',
  billing: 'Billing & subscriptions',
  crm: 'CRM pipeline',
  website: 'Public website',
  analytics: 'Analytics',
  notifications: 'Notifications',
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFeatures()
      .then(setFlags)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: string, value: boolean) {
    setSavingKey(key);
    setError(null);
    try {
      const next = await updateFeatures({ [key]: value });
      setFlags(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!flags) return <p className="text-red-600">{error ?? 'Not available'}</p>;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Feature flags</h1>
      <p className="mt-1 text-sm text-slate-600">
        Enable or disable platform capabilities for your organization. Changes apply immediately.
      </p>

      {error ? <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-6 divide-y divide-slate-100 rounded-lg border border-slate-200">
        {Object.keys(flags).map((key) => (
          <div key={key} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{LABELS[key] ?? key}</p>
              <p className="font-mono text-xs text-slate-400">{key}</p>
            </div>
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={flags[key]}
                disabled={savingKey === key}
                onChange={(e) => toggle(key, e.target.checked)}
              />
              <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-teal-600 after:absolute after:ml-0.5 after:mt-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5 relative" />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
