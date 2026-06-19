export const PROPERTY_TYPES = ['residential', 'commercial'] as const;
export const PROPERTY_CATEGORIES = [
  'flat',
  'villa',
  'plot',
  'office',
  'shop',
  'warehouse',
] as const;
export const PROPERTY_REQUIREMENT_TYPES = ['buy', 'sell', 'rent'] as const;
export const PROPERTY_STATUSES = [
  'draft',
  'pending_review',
  'published',
  'reserved',
  'sold',
  'archived',
] as const;

export type PropertyVideo = {
  id: string;
  url: string;
  title: string | null;
  sort_order: number;
};

export type PropertyImage = {
  id: string;
  url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  sort_order: number;
  is_cover: boolean;
};

export type PropertyAssignment = {
  employee_id: string;
  is_primary: boolean;
  assigned_at: string;
  assigned_by: string | null;
  employee_name: string | null;
};

export type Property = {
  id: string;
  property_code: string;
  title: string;
  slug: string;
  description: string | null;
  type: string;
  category: string;
  requirement_type: string;
  price: number | null;
  maintenance: number | null;
  token_amount: number | null;
  address: string | null;
  city: string;
  state: string | null;
  country: string;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  balconies: number | null;
  floor: number | null;
  total_floors: number | null;
  super_builtup_area: number | null;
  carpet_area: number | null;
  status: string;
  is_public: boolean;
  meta_title: string | null;
  meta_description: string | null;
  amenities: string[];
  tags: string[];
  images: PropertyImage[];
  videos: PropertyVideo[];
  documents: { id: string; name: string; url: string; doc_type: string | null }[];
  assignments: PropertyAssignment[];
  cover_image_url: string | null;
  assigned_to: string | null;
  created_by: string | null;
  updated_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PropertyHistoryEntry = {
  id: string;
  change_type: string;
  changed_fields: Record<string, unknown>;
  changed_by: string | null;
  changed_by_email: string | null;
  created_at: string;
};

export type ListMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

export type PropertySummary = {
  total: number;
  published: number;
  reserved: number;
  sold: number;
  draft: number;
  public_listings: number;
  total_value: number;
  by_status: Record<string, number>;
};

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatINR(value: number | null | undefined): string {
  if (value == null) return '—';
  return inr.format(value);
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending_review: 'bg-amber-100 text-amber-800',
  published: 'bg-green-100 text-green-800',
  reserved: 'bg-blue-100 text-blue-800',
  sold: 'bg-purple-100 text-purple-800',
  archived: 'bg-slate-200 text-slate-500',
};

export function statusBadgeClass(status: string): string {
  return STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700';
}

export function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
