'use client';

import { useEffect, useState } from 'react';

import { FormField } from '../../../../components/ui';
import {
  fetchWhiteLabel,
  updateWhiteLabel,
  type WhiteLabelSettings,
} from '../../../../lib/settings';

export default function WhiteLabelPage() {
  const [wl, setWl] = useState<WhiteLabelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchWhiteLabel()
      .then(setWl)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof WhiteLabelSettings>(key: K, value: WhiteLabelSettings[K]) {
    setWl((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function setLogin<K extends keyof WhiteLabelSettings['custom_login']>(
    key: K,
    value: WhiteLabelSettings['custom_login'][K],
  ) {
    setWl((prev) => (prev ? { ...prev, custom_login: { ...prev.custom_login, [key]: value } } : prev));
    setSaved(false);
  }

  async function onSave() {
    if (!wl) return;
    setSaving(true);
    setError(null);
    try {
      const next = await updateWhiteLabel(wl);
      setWl(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!wl) return <p className="text-red-700">{error ?? 'Unable to load white-label settings.'}</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">White label</h1>
      <p className="mt-1 text-sm text-slate-600">
        Resell RE-OS under your own brand. Hide platform branding and customize the login experience.
      </p>

      {error ? <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="mt-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">Saved.</p> : null}

      <div className="mt-6 space-y-4">
        <Toggle label="Enable white label" checked={wl.enabled} onChange={(v) => set('enabled', v)} />
        <Toggle
          label="Hide RE-OS branding"
          checked={wl.hide_branding}
          onChange={(v) => set('hide_branding', v)}
        />

        <FormField label="Custom logo URL">
          <input
            className="input"
            value={wl.custom_logo_url ?? ''}
            onChange={(e) => set('custom_logo_url', e.target.value || null)}
            placeholder="https://cdn.example.com/logo.svg"
          />
        </FormField>
        <FormField label="Custom favicon URL">
          <input
            className="input"
            value={wl.custom_favicon_url ?? ''}
            onChange={(e) => set('custom_favicon_url', e.target.value || null)}
            placeholder="https://cdn.example.com/favicon.ico"
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Primary color">
            <input
              type="color"
              className="h-10 w-full rounded border border-slate-300"
              value={wl.primary_color ?? '#0f766e'}
              onChange={(e) => set('primary_color', e.target.value)}
            />
          </FormField>
          <FormField label="Secondary color">
            <input
              type="color"
              className="h-10 w-full rounded border border-slate-300"
              value={wl.secondary_color ?? '#0369a1'}
              onChange={(e) => set('secondary_color', e.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Custom email sender">
          <input
            className="input"
            value={wl.email_sender ?? ''}
            onChange={(e) => set('email_sender', e.target.value || null)}
            placeholder="noreply@abc-realty.com"
          />
        </FormField>
      </div>

      <div className="mt-8 rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Custom login page</h2>
        <div className="mt-3 space-y-4">
          <Toggle
            label="Enable custom login"
            checked={wl.custom_login.enabled}
            onChange={(v) => setLogin('enabled', v)}
          />
          <FormField label="Headline">
            <input
              className="input"
              value={wl.custom_login.headline ?? ''}
              onChange={(e) => setLogin('headline', e.target.value || null)}
            />
          </FormField>
          <FormField label="Subtext">
            <input
              className="input"
              value={wl.custom_login.subtext ?? ''}
              onChange={(e) => setLogin('subtext', e.target.value || null)}
            />
          </FormField>
          <FormField label="Background image URL">
            <input
              className="input"
              value={wl.custom_login.background_url ?? ''}
              onChange={(e) => setLogin('background_url', e.target.value || null)}
            />
          </FormField>
        </div>
      </div>

      <button type="button" onClick={onSave} disabled={saving} className="btn-primary mt-6">
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-slate-300 text-teal-700"
      />
    </label>
  );
}
