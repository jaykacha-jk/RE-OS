import type { Metadata } from 'next';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4545';

export type PublicIntent = 'buy' | 'rent' | 'commercial';

export type PublicProperty = {
  title: string;
  slug: string;
  description: string | null;
  type: string;
  category: string;
  requirement_type: string;
  price: number | null;
  maintenance: number | null;
  city: string;
  state: string | null;
  country?: string | null;
  pincode?: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  balconies?: number | null;
  super_builtup_area: number | null;
  carpet_area: number | null;
  meta_title: string | null;
  meta_description: string | null;
  amenities: string[];
  tags?: string[];
  images: { url: string; alt_text: string | null }[];
  videos?: { url: string; title: string | null }[];
  cover_image_url: string | null;
  published_at?: string | null;
};

export type PublicListingResponse = {
  data: PublicProperty[];
  error?: string;
  meta?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    tenant: string;
  };
};

export type PublicWebsiteSettings = {
  hero_title: string | null;
  hero_subtitle: string | null;
  contact: {
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    address?: string | null;
  };
  social_links: Record<string, unknown>;
  testimonials: Array<{
    author?: string;
    role?: string | null;
    quote?: string;
    avatar_url?: string | null;
  }>;
  featured_sections: Array<{
    title?: string;
    subtitle?: string | null;
    type?: string;
    enabled?: boolean;
  }>;
  footer: {
    about?: string | null;
    copyright?: string | null;
    links?: Array<{ label: string; href: string }>;
  };
};

export type PublicSettings = {
  tenant: string;
  name: string;
  branding: {
    logo_url?: string | null;
    primary_color?: string;
    secondary_color?: string;
  };
  website: PublicWebsiteSettings;
  seo: Record<string, unknown>;
  white_label: {
    enabled: boolean;
    hide_branding: boolean;
    custom_logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
  };
  powered_by_reos: boolean;
};

export const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/** Turn a slug or lowercase city name into display/API title case. */
export function formatCityTitle(value: string) {
  return value.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isPublicIntent(value: string): value is PublicIntent {
  return value === 'buy' || value === 'rent' || value === 'commercial';
}

export function intentLabel(intent: PublicIntent) {
  if (intent === 'commercial') return 'Commercial';
  return intent === 'buy' ? 'Buy' : 'Rent';
}

export function intentFilters(intent: PublicIntent): { type: string; requirementType?: string } {
  if (intent === 'commercial') return { type: 'commercial' };
  return { type: 'residential', requirementType: intent };
}

export function propertyIntent(property: Pick<PublicProperty, 'type' | 'requirement_type'>): PublicIntent {
  if (property.type === 'commercial') return 'commercial';
  return property.requirement_type === 'rent' ? 'rent' : 'buy';
}

export function propertyPath(property: Pick<PublicProperty, 'type' | 'requirement_type' | 'city' | 'slug'>) {
  return `/${propertyIntent(property)}/${slugify(property.city)}/${property.slug}`;
}

export function propertyMatchesRoute(property: PublicProperty, intent: PublicIntent, city: string) {
  return propertyIntent(property) === intent && slugify(property.city) === city;
}

/** Build a wa.me link only when the tenant has configured a dialable number. */
export function whatsappHref(phone: string | null | undefined, text: string) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export async function fetchPublicListings(input: {
  tenant: string;
  search?: string;
  city?: string;
  intent?: PublicIntent;
  page?: number;
  perPage?: number;
}): Promise<PublicListingResponse> {
  const params = new URLSearchParams({
    tenant: input.tenant,
    page: String(input.page ?? 1),
    per_page: String(input.perPage ?? 24),
  });
  if (input.search) params.set('search', input.search);
  if (input.city) params.set('filter[city]', input.city);
  if (input.intent) {
    const filters = intentFilters(input.intent);
    if (filters.type) params.set('filter[type]', filters.type);
    if (filters.requirementType) params.set('filter[requirement_type]', filters.requirementType);
  }

  const res = await fetch(`${API_BASE}/api/v1/public/properties?${params.toString()}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    return {
      data: [],
      error: `Unable to load listings (${res.status})`,
    };
  }
  return (await res.json()) as PublicListingResponse;
}

export async function fetchPublicSettings(tenant: string): Promise<PublicSettings | null> {
  const res = await fetch(`${API_BASE}/api/v1/public/settings?tenant=${encodeURIComponent(tenant)}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data: PublicSettings };
  return body.data;
}

export async function fetchPublicProperty(slug: string, tenant: string): Promise<PublicProperty | null> {
  const res = await fetch(
    `${API_BASE}/api/v1/public/properties/${encodeURIComponent(slug)}?tenant=${encodeURIComponent(tenant)}`,
    { next: { revalidate: 300 } },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { data: PublicProperty };
  return body.data;
}

export function buildPropertyMetadata(property: PublicProperty, canonicalPath: string): Metadata {
  const description =
    property.meta_description ??
    `${property.title} in ${property.city}. ${property.bedrooms ? `${property.bedrooms} BHK, ` : ''}${property.super_builtup_area ?? property.carpet_area ?? ''} sqft. Contact now.`;

  return {
    title: property.meta_title ?? `${property.title} in ${property.city}`,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: property.meta_title ?? property.title,
      description,
      url: canonicalPath,
      images: property.cover_image_url ? [property.cover_image_url] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: property.meta_title ?? property.title,
      description,
      images: property.cover_image_url ? [property.cover_image_url] : undefined,
    },
  };
}

export function propertyJsonLd(property: PublicProperty, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description: property.meta_description ?? property.description ?? undefined,
    url: canonicalUrl,
    image: property.images.map((image) => image.url),
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.city,
      addressRegion: property.state ?? undefined,
      addressCountry: property.country ?? 'IN',
      postalCode: property.pincode ?? undefined,
    },
    offers: property.price
      ? {
          '@type': 'Offer',
          price: property.price,
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
        }
      : undefined,
  };
}
