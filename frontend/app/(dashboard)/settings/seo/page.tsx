'use client';

import { FormEvent, useEffect, useState } from 'react';

import { FormField } from '../../../../components/ui';
import { fetchSeo, updateSeo, type SeoSettings } from '../../../../lib/settings';

export default function SeoSettingsPage() {
  const [data, setData] = useState<SeoSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSeo()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  function setTop<K extends keyof SeoSettings>(key: K, value: SeoSettings[K]) {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function setRobots(key: string, value: boolean) {
    setData((prev) => (prev ? { ...prev, robots: { ...prev.robots, [key]: value } } : prev));
    setSaved(false);
  }

  function setSitemap(key: string, value: boolean) {
    setData((prev) => (prev ? { ...prev, sitemap: { ...prev.sitemap, [key]: value } } : prev));
    setSaved(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const next = await updateSeo({
        meta_title: data.meta_title,
        meta_description: data.meta_description,
        robots: data.robots,
        sitemap: data.sitemap,
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

  const robots = data.robots as Record<string, boolean>;
  const sitemap = data.sitemap as Record<string, boolean>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">SEO</h1>
      <p className="mt-1 text-sm text-slate-600">Meta tags, robots rules and sitemap options.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <FormField label="Meta title">
          <input className="input" value={data.meta_title ?? ''} onChange={(e) => setTop('meta_title', e.target.value || null)} />
        </FormField>
        <FormField label="Meta description">
          <textarea
            className="input"
            rows={3}
            value={data.meta_description ?? ''}
            onChange={(e) => setTop('meta_description', e.target.value || null)}
          />
        </FormField>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Robots</h2>
          <Toggle label="Allow indexing (index)" checked={robots.index !== false} onChange={(v) => setRobots('index', v)} />
          <Toggle label="Allow following links (follow)" checked={robots.follow !== false} onChange={(v) => setRobots('follow', v)} />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sitemap</h2>
          <Toggle label="Generate sitemap" checked={sitemap.enabled !== false} onChange={(v) => setSitemap('enabled', v)} />
          <Toggle
            label="Include property pages"
            checked={sitemap.include_properties !== false}
            onChange={(v) => setSitemap('include_properties', v)}
          />
        </section>

        {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {saved ? <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">Saved.</p> : null}

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}
