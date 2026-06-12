'use client';

import { FormEvent, useEffect, useState } from 'react';

import { fetchWebsite, updateWebsite, type WebsiteSettings } from '../../../../lib/settings';

export default function WebsiteSettingsPage() {
  const [data, setData] = useState<WebsiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchWebsite()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  function setTop<K extends keyof WebsiteSettings>(key: K, value: WebsiteSettings[K]) {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function setContact(key: string, value: string) {
    setData((prev) => (prev ? { ...prev, contact: { ...prev.contact, [key]: value || null } } : prev));
    setSaved(false);
  }

  function setSocial(key: string, value: string) {
    setData((prev) =>
      prev ? { ...prev, social_links: { ...prev.social_links, [key]: value || null } } : prev,
    );
    setSaved(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const next = await updateWebsite({
        hero_title: data.hero_title,
        hero_subtitle: data.hero_subtitle,
        contact: data.contact,
        social_links: data.social_links,
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

  const contact = data.contact as Record<string, string | null>;
  const social = data.social_links as Record<string, string | null>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Website content</h1>
      <p className="mt-1 text-sm text-slate-600">Homepage hero, contact details and social links.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Hero</h2>
          <Field label="Hero title">
            <input className="input" value={data.hero_title ?? ''} onChange={(e) => setTop('hero_title', e.target.value || null)} />
          </Field>
          <Field label="Hero subtitle">
            <textarea
              className="input"
              rows={2}
              value={data.hero_subtitle ?? ''}
              onChange={(e) => setTop('hero_subtitle', e.target.value || null)}
            />
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contact</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email">
              <input className="input" value={contact.email ?? ''} onChange={(e) => setContact('email', e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className="input" value={contact.phone ?? ''} onChange={(e) => setContact('phone', e.target.value)} />
            </Field>
            <Field label="WhatsApp">
              <input className="input" value={contact.whatsapp ?? ''} onChange={(e) => setContact('whatsapp', e.target.value)} />
            </Field>
            <Field label="Address">
              <input className="input" value={contact.address ?? ''} onChange={(e) => setContact('address', e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Social links</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {['facebook', 'instagram', 'linkedin', 'twitter', 'youtube'].map((key) => (
              <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
                <input className="input" value={social[key] ?? ''} onChange={(e) => setSocial(key, e.target.value)} />
              </Field>
            ))}
          </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
