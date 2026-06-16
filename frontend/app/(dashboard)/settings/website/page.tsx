'use client';

import { FormEvent, useEffect, useState } from 'react';

import {
  fetchBranding,
  fetchSeo,
  fetchWebsite,
  updateBranding,
  updateSeo,
  updateWebsite,
  type BrandingSettings,
  type SeoSettings,
  type WebsiteSettings,
} from '../../../../lib/settings';

type WebsiteSetupState = {
  branding: BrandingSettings;
  website: WebsiteSettings;
  seo: SeoSettings;
};

export default function WebsiteSettingsPage() {
  const [data, setData] = useState<WebsiteSetupState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([fetchBranding(), fetchWebsite(), fetchSeo()])
      .then(([branding, website, seo]) => setData({ branding, website, seo }))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  function setBranding<K extends keyof BrandingSettings>(key: K, value: BrandingSettings[K]) {
    setData((prev) => (prev ? { ...prev, branding: { ...prev.branding, [key]: value } } : prev));
    setSaved(false);
  }

  function setWebsite<K extends keyof WebsiteSettings>(key: K, value: WebsiteSettings[K]) {
    setData((prev) => (prev ? { ...prev, website: { ...prev.website, [key]: value } } : prev));
    setSaved(false);
  }

  function setContact(key: string, value: string) {
    setData((prev) =>
      prev
        ? { ...prev, website: { ...prev.website, contact: { ...prev.website.contact, [key]: value || null } } }
        : prev,
    );
    setSaved(false);
  }

  function setSocial(key: string, value: string) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            website: { ...prev.website, social_links: { ...prev.website.social_links, [key]: value || null } },
          }
        : prev,
    );
    setSaved(false);
  }

  function setSeo<K extends keyof SeoSettings>(key: K, value: SeoSettings[K]) {
    setData((prev) => (prev ? { ...prev, seo: { ...prev.seo, [key]: value } } : prev));
    setSaved(false);
  }

  function setRobots(key: string, value: boolean) {
    setData((prev) => (prev ? { ...prev, seo: { ...prev.seo, robots: { ...prev.seo.robots, [key]: value } } } : prev));
    setSaved(false);
  }

  function setSitemap(key: string, value: boolean) {
    setData((prev) =>
      prev ? { ...prev, seo: { ...prev.seo, sitemap: { ...prev.seo.sitemap, [key]: value } } } : prev,
    );
    setSaved(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const [branding, website, seo] = await Promise.all([
        updateBranding({
          logo_url: data.branding.logo_url,
          favicon_url: data.branding.favicon_url,
          primary_color: data.branding.primary_color,
          secondary_color: data.branding.secondary_color,
          font_family: data.branding.font_family,
        }),
        updateWebsite({
          hero_title: data.website.hero_title,
          hero_subtitle: data.website.hero_subtitle,
          contact: data.website.contact,
          social_links: data.website.social_links,
        }),
        updateSeo({
          meta_title: data.seo.meta_title,
          meta_description: data.seo.meta_description,
          robots: data.seo.robots,
          sitemap: data.seo.sitemap,
        }),
      ]);
      setData({ branding, website, seo });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!data) return <p className="text-red-600">{error ?? 'Not available'}</p>;

  const contact = data.website.contact as Record<string, string | null>;
  const social = data.website.social_links as Record<string, string | null>;
  const robots = data.seo.robots as Record<string, boolean>;
  const sitemap = data.seo.sitemap as Record<string, boolean>;

  return (
    <div className="max-w-4xl">
      <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-card">
        <p className="eyebrow text-teal-700">Launch setup</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Website Setup</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Publish the essentials buyers need to trust the agency: brand identity, homepage promise, callback channels, and basic search metadata.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <section className="rounded-2xl border border-reos-border bg-white p-5 shadow-card">
          <SectionHeader
            step="1"
            title="Brand basics"
            description="These values appear across the public website, emails, and downloadable material."
          />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Logo URL">
              <input
                className="input"
                value={data.branding.logo_url ?? ''}
                onChange={(e) => setBranding('logo_url', e.target.value || null)}
                placeholder="https://cdn.example.com/logo.png"
              />
            </Field>
            <Field label="Favicon URL">
              <input
                className="input"
                value={data.branding.favicon_url ?? ''}
                onChange={(e) => setBranding('favicon_url', e.target.value || null)}
                placeholder="https://cdn.example.com/favicon.ico"
              />
            </Field>
            <Field label="Primary color">
              <ColorInput value={data.branding.primary_color} onChange={(value) => setBranding('primary_color', value)} />
            </Field>
            <Field label="Secondary color">
              <ColorInput value={data.branding.secondary_color} onChange={(value) => setBranding('secondary_color', value)} />
            </Field>
            <Field label="Font family">
              <input
                className="input"
                value={data.branding.font_family}
                onChange={(e) => setBranding('font_family', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-reos-border bg-white p-5 shadow-card">
          <SectionHeader
            step="2"
            title="Homepage promise"
            description="Keep this focused on inventory, locality trust, and fast callback expectations."
          />
          <div className="mt-4 space-y-4">
          <Field label="Hero title">
              <input
                className="input"
                value={data.website.hero_title ?? ''}
                onChange={(e) => setWebsite('hero_title', e.target.value || null)}
              />
          </Field>
          <Field label="Hero subtitle">
            <textarea
              className="input"
              rows={2}
                value={data.website.hero_subtitle ?? ''}
                onChange={(e) => setWebsite('hero_subtitle', e.target.value || null)}
            />
          </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-reos-border bg-white p-5 shadow-card">
          <SectionHeader
            step="3"
            title="Lead capture channels"
            description="These public contact details should route directly into the team that owns new inquiries."
          />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <section className="rounded-2xl border border-reos-border bg-white p-5 shadow-card">
          <SectionHeader
            step="4"
            title="Social proof"
            description="Add only active profiles that help buyers verify the agency."
          />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {['facebook', 'instagram', 'linkedin', 'twitter', 'youtube'].map((key) => (
              <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
                <input className="input" value={social[key] ?? ''} onChange={(e) => setSocial(key, e.target.value)} />
              </Field>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-reos-border bg-white p-5 shadow-card">
          <SectionHeader
            step="5"
            title="Search basics"
            description="Launch-safe SEO controls. Advanced schema, Open Graph, and Twitter card settings remain available at /settings/seo."
          />
          <div className="mt-4 space-y-4">
            <Field label="Meta title">
              <input
                className="input"
                value={data.seo.meta_title ?? ''}
                onChange={(e) => setSeo('meta_title', e.target.value || null)}
              />
            </Field>
            <Field label="Meta description">
              <textarea
                className="input"
                rows={3}
                value={data.seo.meta_description ?? ''}
                onChange={(e) => setSeo('meta_description', e.target.value || null)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle label="Allow indexing" checked={robots.index !== false} onChange={(v) => setRobots('index', v)} />
              <Toggle label="Follow links" checked={robots.follow !== false} onChange={(v) => setRobots('follow', v)} />
              <Toggle label="Generate sitemap" checked={sitemap.enabled !== false} onChange={(v) => setSitemap('enabled', v)} />
              <Toggle
                label="Include property pages"
                checked={sitemap.include_properties !== false}
                onChange={(v) => setSitemap('include_properties', v)}
              />
            </div>
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

function SectionHeader({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-800">
        {step}
      </span>
      <div>
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
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

function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 rounded border border-slate-300"
      />
      <input className="input flex-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}
