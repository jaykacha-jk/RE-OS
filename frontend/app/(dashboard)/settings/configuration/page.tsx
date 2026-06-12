'use client';

import { useEffect, useState } from 'react';

import {
  fetchConfiguration,
  updateConfiguration,
  type TenantConfiguration,
} from '../../../../lib/settings';

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'UTC', 'America/New_York', 'Europe/London'];
const CURRENCIES = ['INR', 'USD', 'AED', 'GBP', 'EUR'];
const LANGUAGES = ['en', 'hi', 'mr', 'gu', 'ta'];
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const NUMBER_FORMATS = ['en-IN', 'en-US', 'en-GB'];

export default function ConfigurationPage() {
  const [config, setConfig] = useState<TenantConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchConfiguration()
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof TenantConfiguration>(key: K, value: TenantConfiguration[K]) {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function onSave() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const next = await updateConfiguration(config);
      setConfig(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!config) return <p className="text-red-700">{error ?? 'Unable to load configuration.'}</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Configuration</h1>
      <p className="mt-1 text-sm text-slate-600">Regional defaults applied across the platform.</p>

      {error ? <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="mt-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">Saved.</p> : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Timezone">
          <select className="input" value={config.timezone} onChange={(e) => set('timezone', e.target.value)}>
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Currency">
          <select className="input" value={config.currency} onChange={(e) => set('currency', e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Language">
          <select className="input" value={config.language} onChange={(e) => set('language', e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date format">
          <select
            className="input"
            value={config.date_format}
            onChange={(e) => set('date_format', e.target.value)}
          >
            {DATE_FORMATS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Number format">
          <select
            className="input"
            value={config.number_format}
            onChange={(e) => set('number_format', e.target.value)}
          >
            {NUMBER_FORMATS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <button type="button" onClick={onSave} disabled={saving} className="btn-primary mt-6">
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
