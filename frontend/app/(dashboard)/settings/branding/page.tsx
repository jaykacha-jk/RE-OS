'use client';

import { FormEvent, useEffect, useState } from 'react';

import { FormField } from '../../../../components/ui';
import { fetchBranding, updateBranding, type BrandingSettings } from '../../../../lib/settings';

export default function BrandingSettingsPage() {
  const [data, setData] = useState<BrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchBranding()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof BrandingSettings>(key: K, value: BrandingSettings[K]) {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const next = await updateBranding({
        logo_url: data.logo_url,
        favicon_url: data.favicon_url,
        primary_color: data.primary_color,
        secondary_color: data.secondary_color,
        font_family: data.font_family,
      });
      setData(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!data) return <p className="text-red-600">{error ?? 'Not available'}</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Branding</h1>
      <p className="mt-1 text-sm text-slate-600">Logo, favicon, colors and typography for your brand.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <FormField label="Logo URL">
          <input
            className="input"
            value={data.logo_url ?? ''}
            onChange={(e) => set('logo_url', e.target.value || null)}
            placeholder="https://cdn.example.com/logo.png"
          />
        </FormField>
        <FormField label="Favicon URL">
          <input
            className="input"
            value={data.favicon_url ?? ''}
            onChange={(e) => set('favicon_url', e.target.value || null)}
            placeholder="https://cdn.example.com/favicon.ico"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Primary color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={data.primary_color}
                onChange={(e) => set('primary_color', e.target.value)}
                className="h-9 w-12 rounded border border-slate-300"
              />
              <input
                className="input flex-1"
                value={data.primary_color}
                onChange={(e) => set('primary_color', e.target.value)}
              />
            </div>
          </FormField>
          <FormField label="Secondary color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={data.secondary_color}
                onChange={(e) => set('secondary_color', e.target.value)}
                className="h-9 w-12 rounded border border-slate-300"
              />
              <input
                className="input flex-1"
                value={data.secondary_color}
                onChange={(e) => set('secondary_color', e.target.value)}
              />
            </div>
          </FormField>
        </div>

        <FormField label="Font family">
          <input
            className="input"
            value={data.font_family}
            onChange={(e) => set('font_family', e.target.value)}
          />
        </FormField>

        {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {saved ? <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">Saved.</p> : null}

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
