/**
 * Phase 9 — Enterprise + White Label Platform.
 *
 * Tenant settings are stored one row per category in `tenant_settings`. The
 * defaults below are merged (shallow, per top-level key) over whatever the
 * tenant has persisted so a brand-new tenant always gets a sensible, complete
 * configuration object. Nothing here is hard-coded into business logic — feature
 * flags and configuration are always resolved from the database via the
 * TenantConfigService.
 */

export const SETTINGS_CATEGORIES = [
  'branding',
  'seo',
  'website',
  'features',
  'configuration',
  'white_label',
] as const;

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

/** Cache TTL — short, Redis-shaped (PERFORMANCE rule). */
export const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Feature flags — stored in DB, never hard-coded.
// ---------------------------------------------------------------------------

export const DEFAULT_FEATURES: Record<string, boolean> = {
  chat: true,
  ai: false,
  billing: true,
  crm: true,
  website: true,
  domains: true,
  analytics: true,
  notifications: true,
};

// ---------------------------------------------------------------------------
// Tenant configuration (Indian-market defaults — BUSINESS rule).
// ---------------------------------------------------------------------------

export const DEFAULT_CHAT_CONFIGURATION = {
  /** BR-CH02: round-robin assign unassigned conversations after delay. */
  auto_assign_enabled: true,
  auto_assign_delay_minutes: 5,
  /** Create/link CRM inquiry when a visitor provides a phone in live chat. */
  auto_create_inquiry_on_phone: true,
};

export const DEFAULT_CONFIGURATION = {
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  language: 'en',
  date_format: 'DD/MM/YYYY',
  number_format: 'en-IN',
  chat: DEFAULT_CHAT_CONFIGURATION,
  business_hours: {
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '18:00', closed: false },
    saturday: { open: '10:00', close: '14:00', closed: false },
    sunday: { open: '00:00', close: '00:00', closed: true },
  },
};

// ---------------------------------------------------------------------------
// Branding.
// ---------------------------------------------------------------------------

export const DEFAULT_BRANDING = {
  logo_url: null as string | null,
  favicon_url: null as string | null,
  primary_color: '#0f766e',
  secondary_color: '#0369a1',
  font_family: 'Inter',
  email_branding: {
    from_name: null as string | null,
    header_logo_url: null as string | null,
    footer_text: null as string | null,
    accent_color: '#0f766e',
  },
  pdf_branding: {
    header_logo_url: null as string | null,
    footer_text: null as string | null,
    accent_color: '#0f766e',
  },
};

// ---------------------------------------------------------------------------
// SEO.
// ---------------------------------------------------------------------------

export const DEFAULT_SEO = {
  meta_title: null as string | null,
  meta_description: null as string | null,
  open_graph: {
    title: null as string | null,
    description: null as string | null,
    image_url: null as string | null,
    type: 'website',
  },
  twitter_card: {
    card: 'summary_large_image',
    site: null as string | null,
    title: null as string | null,
    description: null as string | null,
    image_url: null as string | null,
  },
  default_schema: {
    organization_type: 'RealEstateAgent',
    enabled: true,
  },
  robots: {
    index: true,
    follow: true,
    custom_rules: [] as string[],
  },
  sitemap: {
    enabled: true,
    include_properties: true,
    change_frequency: 'daily',
    priority: 0.7,
  },
};

// ---------------------------------------------------------------------------
// Website content.
// ---------------------------------------------------------------------------

export const DEFAULT_WEBSITE = {
  hero_title: null as string | null,
  hero_subtitle: null as string | null,
  contact: {
    email: null as string | null,
    phone: null as string | null,
    whatsapp: null as string | null,
    address: null as string | null,
  },
  social_links: {
    facebook: null as string | null,
    instagram: null as string | null,
    linkedin: null as string | null,
    twitter: null as string | null,
    youtube: null as string | null,
  },
  testimonials: [] as Array<{
    author: string;
    role?: string | null;
    quote: string;
    avatar_url?: string | null;
  }>,
  featured_sections: [] as Array<{
    title: string;
    subtitle?: string | null;
    type: string;
    enabled: boolean;
  }>,
  footer: {
    about: null as string | null,
    copyright: null as string | null,
    links: [] as Array<{ label: string; href: string }>,
  },
};

// ---------------------------------------------------------------------------
// White label.
// ---------------------------------------------------------------------------

export const DEFAULT_WHITE_LABEL = {
  enabled: false,
  hide_branding: false,
  custom_logo_url: null as string | null,
  custom_favicon_url: null as string | null,
  primary_color: null as string | null,
  secondary_color: null as string | null,
  email_sender: null as string | null,
  custom_login: {
    enabled: false,
    headline: null as string | null,
    subtext: null as string | null,
    background_url: null as string | null,
  },
};

export const CATEGORY_DEFAULTS: Record<SettingsCategory, Record<string, unknown>> = {
  branding: DEFAULT_BRANDING,
  seo: DEFAULT_SEO,
  website: DEFAULT_WEBSITE,
  features: DEFAULT_FEATURES,
  configuration: DEFAULT_CONFIGURATION,
  white_label: DEFAULT_WHITE_LABEL,
};

/**
 * Required permission to mutate each settings category.
 * RBAC.md: Owner = full settings; Admin = limited (no features/white_label);
 * Manager = read only; Sales = no access.
 */
export const CATEGORY_WRITE_PERMISSION: Record<SettingsCategory, string> = {
  branding: 'settings.branding.manage',
  seo: 'settings.seo.manage',
  website: 'settings.website.manage',
  features: 'settings.features.manage',
  configuration: 'settings.configuration.manage',
  white_label: 'settings.whitelabel.manage',
};
