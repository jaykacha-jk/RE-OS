import {
  LEAD_SCORE_WEIGHTS,
  TEMPERATURE_THRESHOLDS,
  type LeadTemperature,
} from '../ai.constants';

/**
 * Structured requirements extracted from a conversation/call. Mirrors the GPT
 * extraction schema in docs/AI_AGENT_SPEC.md §4 but is produced by a pure,
 * deterministic rule engine so it works with ANY provider (or none).
 */
export interface ExtractedRequirements {
  budget_min: number | null;
  budget_max: number | null;
  city: string | null;
  area: string | null;
  property_type: 'residential' | 'commercial' | null;
  requirement_type: 'buy' | 'sell' | 'rent' | null;
  bedrooms: number | null;
  timeline: 'immediate' | '1_3_months' | '3_6_months' | '6_12_months' | 'exploring' | null;
  financing_need: boolean | null;
  intent: 'buy' | 'sell' | 'rent' | 'explore' | null;
  confidence: number;
}

export interface EngagementSignals {
  /** Number of client turns / responses in the conversation. */
  responses?: number;
  /** Call/chat duration in seconds. */
  durationSeconds?: number;
}

export interface ScoreBreakdown {
  budget: number;
  timeline: number;
  requirement: number;
  engagement: number;
}

export interface QualificationResult {
  extracted: ExtractedRequirements;
  score: number;
  breakdown: ScoreBreakdown;
  temperature: LeadTemperature;
}

const KNOWN_CITIES = [
  'ahmedabad',
  'mumbai',
  'pune',
  'bangalore',
  'bengaluru',
  'hyderabad',
  'chennai',
  'delhi',
  'gurgaon',
  'gurugram',
  'noida',
  'kolkata',
  'surat',
  'jaipur',
  'indore',
];

/** Parse an Indian currency phrase into a rupee amount (lakh/crore aware). */
export function parseIndianAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim().toLowerCase();
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(cr|crore|crores|l|lac|lakh|lakhs|k|thousand)?/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  const unit = match[2];
  if (!unit) {
    // Bare number: interpret small numbers as lakhs (common in IN real estate).
    if (value < 1000) return Math.round(value * 100000);
    return Math.round(value);
  }
  if (/^cr/.test(unit)) return Math.round(value * 10000000);
  if (/^l/.test(unit)) return Math.round(value * 100000);
  if (unit === 'k' || unit === 'thousand') return Math.round(value * 1000);
  return Math.round(value);
}

function extractBudget(text: string): { min: number | null; max: number | null } {
  // Range like "90 lakh to 1 crore" / "between 50L and 60L" / "80-90 lakhs"
  const rangeMatch = text.match(
    /(\d+(?:\.\d+)?\s*(?:cr|crore|crores|l|lac|lakh|lakhs|k)?)\s*(?:-|to|and|–)\s*(\d+(?:\.\d+)?\s*(?:cr|crore|crores|l|lac|lakh|lakhs|k)?)/i,
  );
  if (rangeMatch) {
    const min = parseIndianAmount(rangeMatch[1]);
    const max = parseIndianAmount(rangeMatch[2]);
    if (min != null && max != null) {
      return { min: Math.min(min, max), max: Math.max(min, max) };
    }
  }
  // Single budget like "budget is 80 lakhs" / "around 1 crore" / "under 75L"
  const single = text.match(
    /(?:budget|around|approx|approximately|upto|up to|under|below|max|maximum|near)\s*(?:is|of|:)?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?\s*(?:cr|crore|crores|l|lac|lakh|lakhs|k))/i,
  );
  if (single) {
    const amount = parseIndianAmount(single[1]);
    if (amount != null) return { min: Math.round(amount * 0.85), max: amount };
  }
  const bare = text.match(/(\d+(?:\.\d+)?\s*(?:cr|crore|crores|lakh|lakhs|lac|l))/i);
  if (bare) {
    const amount = parseIndianAmount(bare[1]);
    if (amount != null) return { min: Math.round(amount * 0.85), max: Math.round(amount * 1.1) };
  }
  return { min: null, max: null };
}

function extractBedrooms(text: string): number | null {
  const bhk = text.match(/(\d+)\s*(?:\.5\s*)?bhk/i);
  if (bhk) return parseInt(bhk[1], 10);
  const bed = text.match(/(\d+)\s*(?:bed|bedroom|bedrooms)/i);
  if (bed) return parseInt(bed[1], 10);
  return null;
}

function extractCityArea(text: string): { city: string | null; area: string | null } {
  const lower = text.toLowerCase();
  const city = KNOWN_CITIES.find((c) => lower.includes(c)) ?? null;
  // Area: "in <Area>" capturing capitalized phrase, fallback to known landmarks.
  const areaMatch = text.match(/\bin\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/);
  let area = areaMatch ? areaMatch[1].trim() : null;
  if (area && KNOWN_CITIES.includes(area.toLowerCase())) area = null;
  return { city: city ? titleCase(city) : null, area };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractTimeline(text: string): ExtractedRequirements['timeline'] {
  const lower = text.toLowerCase();
  if (/immediate|asap|right now|urgent|this month/.test(lower)) return 'immediate';
  if (/1\s*-?\s*3\s*month|next month|couple of months|two months|month or two/.test(lower))
    return '1_3_months';
  if (/3\s*-?\s*6\s*month|few months|quarter/.test(lower)) return '3_6_months';
  if (/6\s*-?\s*12\s*month|this year|end of the year|year/.test(lower)) return '6_12_months';
  if (/just (?:looking|exploring|browsing)|not sure|no rush|exploring/.test(lower)) return 'exploring';
  return null;
}

function extractRequirementType(text: string): ExtractedRequirements['requirement_type'] {
  const lower = text.toLowerCase();
  if (/\brent|rental|lease|tenant\b/.test(lower)) return 'rent';
  if (/\bsell|selling|list my\b/.test(lower)) return 'sell';
  if (/\bbuy|buying|purchase|own\b/.test(lower)) return 'buy';
  return null;
}

function extractPropertyType(text: string): ExtractedRequirements['property_type'] {
  const lower = text.toLowerCase();
  if (/office|shop|commercial|warehouse|retail|showroom/.test(lower)) return 'commercial';
  if (/flat|apartment|villa|house|bhk|plot|bungalow|residential/.test(lower)) return 'residential';
  return null;
}

function extractFinancing(text: string): boolean | null {
  const lower = text.toLowerCase();
  if (/home loan|need (?:a )?loan|finance|emi|mortgage|loan for/.test(lower)) return true;
  if (/cash|full payment|no loan|self[- ]funded/.test(lower)) return false;
  return null;
}

/**
 * Pure, deterministic requirement extraction (BR-AI03). Confidence reflects how
 * many distinct signals were detected — used by BR-AI04 to gate CRM auto-fill.
 */
export function extractRequirements(text: string): ExtractedRequirements {
  const budget = extractBudget(text);
  const { city, area } = extractCityArea(text);
  const property_type = extractPropertyType(text);
  const requirement_type = extractRequirementType(text);
  const bedrooms = extractBedrooms(text);
  const timeline = extractTimeline(text);
  const financing_need = extractFinancing(text);

  const signals = [
    budget.max != null,
    city != null || area != null,
    property_type != null,
    requirement_type != null,
    bedrooms != null,
    timeline != null,
    financing_need != null,
  ];
  const detected = signals.filter(Boolean).length;
  const confidence = Math.min(1, Number((detected / signals.length).toFixed(2)));

  const intent: ExtractedRequirements['intent'] =
    requirement_type === 'sell'
      ? 'sell'
      : requirement_type === 'rent'
        ? 'rent'
        : requirement_type === 'buy'
          ? 'buy'
          : timeline === 'exploring'
            ? 'explore'
            : null;

  return {
    budget_min: budget.min,
    budget_max: budget.max,
    city,
    area,
    property_type,
    requirement_type,
    bedrooms,
    timeline,
    financing_need,
    intent,
    confidence,
  };
}

const TIMELINE_SCORE: Record<NonNullable<ExtractedRequirements['timeline']>, number> = {
  immediate: 1,
  '1_3_months': 0.85,
  '3_6_months': 0.6,
  '6_12_months': 0.35,
  exploring: 0.15,
};

/** BR-AI01: weighted lead score (0–100) + per-signal breakdown. */
export function scoreLead(
  extracted: ExtractedRequirements,
  engagement: EngagementSignals = {},
): { score: number; breakdown: ScoreBreakdown } {
  const budgetClarity = extracted.budget_max != null ? (extracted.budget_min != null ? 1 : 0.7) : 0;
  const timelineUrgency = extracted.timeline ? TIMELINE_SCORE[extracted.timeline] : 0;

  const requirementSignals = [
    extracted.city != null || extracted.area != null,
    extracted.property_type != null,
    extracted.requirement_type != null,
    extracted.bedrooms != null,
  ].filter(Boolean).length;
  const requirementMatch = requirementSignals / 4;

  const responses = engagement.responses ?? 0;
  const duration = engagement.durationSeconds ?? 0;
  const engagementScore = Math.min(1, responses / 4) * 0.6 + Math.min(1, duration / 180) * 0.4;

  const breakdown: ScoreBreakdown = {
    budget: Math.round(budgetClarity * LEAD_SCORE_WEIGHTS.budget),
    timeline: Math.round(timelineUrgency * LEAD_SCORE_WEIGHTS.timeline),
    requirement: Math.round(requirementMatch * LEAD_SCORE_WEIGHTS.requirement),
    engagement: Math.round(engagementScore * LEAD_SCORE_WEIGHTS.engagement),
  };
  const score = Math.max(
    0,
    Math.min(100, breakdown.budget + breakdown.timeline + breakdown.requirement + breakdown.engagement),
  );
  return { score, breakdown };
}

/** BR-AI02: classify a 0–100 score into hot / warm / cold. */
export function classifyTemperature(score: number): LeadTemperature {
  if (score >= TEMPERATURE_THRESHOLDS.hot) return 'hot';
  if (score >= TEMPERATURE_THRESHOLDS.warm) return 'warm';
  return 'cold';
}

/** End-to-end qualification from raw text + engagement signals. */
export function qualify(text: string, engagement: EngagementSignals = {}): QualificationResult {
  const extracted = extractRequirements(text);
  const { score, breakdown } = scoreLead(extracted, engagement);
  return { extracted, score, breakdown, temperature: classifyTemperature(score) };
}
