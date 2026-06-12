import { apiFetch } from './api';
import { getSession } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type BrandingSettings = {
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  email_branding: Record<string, unknown>;
  pdf_branding: Record<string, unknown>;
};

export type SeoSettings = {
  meta_title: string | null;
  meta_description: string | null;
  open_graph: Record<string, unknown>;
  twitter_card: Record<string, unknown>;
  default_schema: Record<string, unknown>;
  robots: Record<string, unknown>;
  sitemap: Record<string, unknown>;
};

export type WebsiteSettings = {
  hero_title: string | null;
  hero_subtitle: string | null;
  contact: Record<string, unknown>;
  social_links: Record<string, unknown>;
  testimonials: Array<Record<string, unknown>>;
  featured_sections: Array<Record<string, unknown>>;
  footer: Record<string, unknown>;
};

export type FeatureFlags = Record<string, boolean>;

export type TenantConfiguration = {
  timezone: string;
  currency: string;
  language: string;
  date_format: string;
  number_format: string;
  business_hours: Record<string, unknown>;
};

export type WhiteLabelSettings = {
  enabled: boolean;
  hide_branding: boolean;
  custom_logo_url: string | null;
  custom_favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  email_sender: string | null;
  custom_login: {
    enabled: boolean;
    headline: string | null;
    subtext: string | null;
    background_url: string | null;
  };
};

export type CustomDomain = {
  id: string;
  domain: string;
  is_primary: boolean;
  ssl_status: string;
  verification_status: string;
  verification_token: string;
  dns_records: Array<{ type: string; host: string; value: string; purpose: string }>;
  verified_at: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicAnalytics = {
  range: string;
  date_from: string;
  date_to: string;
  totals: {
    page_views: number;
    property_views: number;
    property_clicks: number;
    inquiry_conversions: number;
    chat_conversions: number;
  };
  conversion: {
    inquiry_conversion_rate: number;
    chat_conversion_rate: number;
    click_through_rate: number;
  };
  top_pages: Array<{ path: string | null; views: number }>;
  top_properties: Array<{ entity_id: string | null; views: number }>;
  traffic_sources: Array<{ source: string; count: number }>;
  referrers: Array<{ referrer: string | null; count: number }>;
};

function token() {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.access_token;
}

// --- Settings categories -----------------------------------------------------

export async function fetchBranding() {
  return (await apiFetch<BrandingSettings>('/api/v1/settings/branding', { token: token() })).data;
}

export async function updateBranding(patch: Partial<BrandingSettings>) {
  return (
    await apiFetch<BrandingSettings>('/api/v1/settings/branding', {
      token: token(),
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function fetchSeo() {
  return (await apiFetch<SeoSettings>('/api/v1/settings/seo', { token: token() })).data;
}

export async function updateSeo(patch: Partial<SeoSettings>) {
  return (
    await apiFetch<SeoSettings>('/api/v1/settings/seo', {
      token: token(),
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function fetchWebsite() {
  return (await apiFetch<WebsiteSettings>('/api/v1/settings/website', { token: token() })).data;
}

export async function updateWebsite(patch: Partial<WebsiteSettings>) {
  return (
    await apiFetch<WebsiteSettings>('/api/v1/settings/website', {
      token: token(),
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function fetchFeatures() {
  return (await apiFetch<FeatureFlags>('/api/v1/settings/features', { token: token() })).data;
}

export async function updateFeatures(patch: Partial<FeatureFlags>) {
  return (
    await apiFetch<FeatureFlags>('/api/v1/settings/features', {
      token: token(),
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function fetchConfiguration() {
  return (await apiFetch<TenantConfiguration>('/api/v1/settings/configuration', { token: token() })).data;
}

export async function updateConfiguration(patch: Partial<TenantConfiguration>) {
  return (
    await apiFetch<TenantConfiguration>('/api/v1/settings/configuration', {
      token: token(),
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function fetchWhiteLabel() {
  return (await apiFetch<WhiteLabelSettings>('/api/v1/settings/white-label', { token: token() })).data;
}

export async function updateWhiteLabel(patch: Partial<WhiteLabelSettings>) {
  return (
    await apiFetch<WhiteLabelSettings>('/api/v1/settings/white-label', {
      token: token(),
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  ).data;
}

// --- Custom domains ----------------------------------------------------------

export async function fetchDomains() {
  return (await apiFetch<CustomDomain[]>('/api/v1/settings/domains', { token: token() })).data;
}

export async function addDomain(domain: string, isPrimary = false) {
  return (
    await apiFetch<CustomDomain>('/api/v1/settings/domains', {
      token: token(),
      method: 'POST',
      body: JSON.stringify({ domain, is_primary: isPrimary }),
    })
  ).data;
}

export async function verifyDomain(id: string) {
  return (
    await apiFetch<CustomDomain>(`/api/v1/settings/domains/${id}/verify`, {
      token: token(),
      method: 'POST',
    })
  ).data;
}

export async function removeDomain(id: string) {
  return (
    await apiFetch<{ id: string; deleted: boolean }>(`/api/v1/settings/domains/${id}`, {
      token: token(),
      method: 'DELETE',
    })
  ).data;
}

// --- Public analytics --------------------------------------------------------

export async function fetchPublicAnalytics(range = '30d') {
  return (
    await apiFetch<PublicAnalytics>(`/api/v1/analytics/public?range=${encodeURIComponent(range)}`, {
      token: token(),
    })
  ).data;
}

// --- Audit export ------------------------------------------------------------

/** Downloads the audit-log CSV honouring the current filters. */
export async function downloadAuditCsv(params: URLSearchParams) {
  const res = await fetch(`${API_BASE}/api/v1/audit-logs/export?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'audit-logs.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
