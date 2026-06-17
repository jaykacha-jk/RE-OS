export const INQUIRY_STAGES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SITE_VISIT_SCHEDULED',
  'SITE_VISIT_COMPLETED',
  'NEGOTIATION',
  'BOOKED',
  'CLOSED_WON',
  'CLOSED_LOST',
] as const;
export type InquiryStage = (typeof INQUIRY_STAGES)[number];

/** Kanban columns (short labels) in pipeline order. */
export const KANBAN_COLUMNS: { stage: InquiryStage; label: string }[] = [
  { stage: 'NEW', label: 'New' },
  { stage: 'CONTACTED', label: 'Contacted' },
  { stage: 'QUALIFIED', label: 'Qualified' },
  { stage: 'SITE_VISIT_SCHEDULED', label: 'Site Visit' },
  { stage: 'NEGOTIATION', label: 'Negotiation' },
  { stage: 'BOOKED', label: 'Booked' },
  { stage: 'CLOSED_WON', label: 'Won' },
  { stage: 'CLOSED_LOST', label: 'Lost' },
];

export const INQUIRY_PRIORITIES = ['low', 'medium', 'high'] as const;
export const INQUIRY_TEMPERATURES = ['hot', 'warm', 'cold'] as const;
export const INQUIRY_REQUIREMENT_TYPES = ['buy', 'sell', 'rent'] as const;
export const INQUIRY_PROPERTY_TYPES = ['residential', 'commercial'] as const;
export const INQUIRY_PURCHASE_TIMELINES = [
  'immediate',
  '1_3_months',
  '3_6_months',
  '6_12_months',
  'exploring',
] as const;
export const FOLLOWUP_TYPES = ['call', 'meeting', 'whatsapp', 'site_visit', 'email'] as const;
export const FOLLOWUP_STATUSES = ['pending', 'completed', 'missed', 'rescheduled'] as const;
export const SITE_VISIT_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'] as const;

export type LeadSource = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
};

export type InquiryFollowup = {
  id: string;
  followup_date: string;
  followup_time: string | null;
  followup_type: string;
  status: string;
  notes: string | null;
  completed_at: string | null;
  assigned_employee_id: string | null;
  assigned_employee_name: string | null;
  created_at: string;
};

export type SiteVisit = {
  id: string;
  scheduled_at: string;
  completed_at: string | null;
  status: string;
  notes: string | null;
  property_id: string | null;
  property: { id: string; property_code: string; title: string } | null;
  employee_id: string | null;
  employee_name: string | null;
  created_at: string;
};

export type InquiryNote = {
  id: string;
  note: string;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
};

export type Inquiry = {
  id: string;
  inquiry_code: string;
  client_name: string;
  phone: string;
  email: string | null;
  whatsapp: string | null;
  stage: string;
  priority: string;
  temperature: string;
  lead_score: number | null;
  requirement_type: string | null;
  property_type: string | null;
  preferred_location: string | null;
  bedrooms: number | null;
  budget_min: number | null;
  budget_max: number | null;
  booking_amount: number | null;
  expected_commission: number | null;
  received_commission: number | null;
  commission_status: string | null;
  purchase_timeline: string | null;
  source_id: string | null;
  source_name: string | null;
  property_id: string | null;
  property: { id: string; property_code: string; title: string } | null;
  assigned_employee_id: string | null;
  assigned_employee_name: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  // Detail-only
  remarks?: string | null;
  lost_reason?: string | null;
  no_property_reason?: string | null;
  notes?: InquiryNote[];
  followups?: InquiryFollowup[];
  site_visits?: SiteVisit[];
};

export type TimelineActivity = {
  id: string;
  activity_type: string;
  content: string | null;
  metadata: Record<string, unknown>;
  actor_id: string | null;
  actor_email: string | null;
  created_at: string;
};

export type InquiryHistoryEntry = {
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

export type CrmMetrics = {
  total_leads: number;
  qualified_leads: number;
  site_visits: number;
  won_deals: number;
  lost_deals: number;
  conversion_rate: number;
  by_stage: Record<string, number>;
  top_performer: { employee_id: string; name: string | null; won: number } | null;
};

export type InquirySummary = {
  total: number;
  hot: number;
  unassigned: number;
  stale_new: number;
  qualified: number;
  booked: number;
  won: number;
  lost: number;
  by_stage: Record<string, number>;
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

export function budgetLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${formatINR(min)} – ${formatINR(max)}`;
  return formatINR(min ?? max);
}

export function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const STAGE_STYLES: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-700',
  CONTACTED: 'bg-sky-100 text-sky-800',
  QUALIFIED: 'bg-indigo-100 text-indigo-800',
  SITE_VISIT_SCHEDULED: 'bg-amber-100 text-amber-800',
  SITE_VISIT_COMPLETED: 'bg-amber-100 text-amber-900',
  NEGOTIATION: 'bg-orange-100 text-orange-800',
  BOOKED: 'bg-teal-100 text-teal-800',
  CLOSED_WON: 'bg-green-100 text-green-800',
  CLOSED_LOST: 'bg-red-100 text-red-700',
};

export function stageBadgeClass(stage: string): string {
  return STAGE_STYLES[stage] ?? 'bg-slate-100 text-slate-700';
}

const TEMPERATURE_STYLES: Record<string, string> = {
  hot: 'bg-red-100 text-red-700',
  warm: 'bg-amber-100 text-amber-800',
  cold: 'bg-sky-100 text-sky-800',
};

export function temperatureBadgeClass(t: string): string {
  return TEMPERATURE_STYLES[t] ?? 'bg-slate-100 text-slate-700';
}

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-slate-100 text-slate-700',
  low: 'bg-slate-100 text-slate-500',
};

export function priorityBadgeClass(p: string): string {
  return PRIORITY_STYLES[p] ?? 'bg-slate-100 text-slate-700';
}

export function stageLabel(stage: string): string {
  return humanize(stage);
}
