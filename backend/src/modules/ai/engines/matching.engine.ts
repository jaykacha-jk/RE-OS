import type { ExtractedRequirements } from './qualification.engine';

/** Normalized property shape the matcher operates on (provider-agnostic). */
export interface MatchableProperty {
  id: string;
  title: string;
  property_code: string;
  slug: string;
  city: string | null;
  type: string | null; // residential | commercial
  category: string | null;
  requirement_type: string | null; // buy | sell | rent
  price: number | null;
  bedrooms: number | null;
  amenities: string[];
}

/** Requirement inputs for matching — a subset of extracted requirements. */
export interface MatchCriteria {
  budget_min?: number | null;
  budget_max?: number | null;
  city?: string | null;
  area?: string | null;
  property_type?: string | null;
  requirement_type?: string | null;
  bedrooms?: number | null;
  amenities?: string[];
}

export interface PropertyMatch {
  property: MatchableProperty;
  score: number;
  reasons: string[];
}

const WEIGHTS = {
  budget: 35,
  location: 25,
  type: 15,
  bedrooms: 15,
  requirement: 10,
} as const;

export function criteriaFromRequirements(req: ExtractedRequirements): MatchCriteria {
  return {
    budget_min: req.budget_min,
    budget_max: req.budget_max,
    city: req.city,
    area: req.area,
    property_type: req.property_type,
    requirement_type: req.requirement_type,
    bedrooms: req.bedrooms,
  };
}

function scoreBudget(price: number | null, min?: number | null, max?: number | null): number {
  if (price == null || (min == null && max == null)) return 0.4; // unknown → neutral-ish
  const lo = min ?? 0;
  const hi = max ?? Number.MAX_SAFE_INTEGER;
  if (price >= lo && price <= hi) return 1;
  // Penalize by relative distance to the nearest bound (10% slack = 0.7).
  const bound = price < lo ? lo : hi;
  const delta = Math.abs(price - bound) / Math.max(bound, 1);
  return Math.max(0, 1 - delta * 3);
}

function scoreLocation(
  propCity: string | null,
  title: string,
  city?: string | null,
  area?: string | null,
): { score: number; matched: string | null } {
  if (!city && !area) return { score: 0.5, matched: null };
  const pCity = (propCity ?? '').toLowerCase();
  const hay = `${propCity ?? ''} ${title}`.toLowerCase();
  if (area && hay.includes(area.toLowerCase())) return { score: 1, matched: area };
  if (city && pCity === city.toLowerCase()) return { score: 0.9, matched: city };
  if (city && hay.includes(city.toLowerCase())) return { score: 0.8, matched: city };
  return { score: 0, matched: null };
}

/**
 * Score a single property against criteria. Returns a 0–100 match score and
 * human-readable reasoning so agents trust the recommendation.
 */
export function scoreProperty(property: MatchableProperty, criteria: MatchCriteria): PropertyMatch {
  const reasons: string[] = [];

  const budget = scoreBudget(property.price, criteria.budget_min, criteria.budget_max);
  if (budget >= 0.99 && property.price != null) reasons.push('Within budget');
  else if (budget >= 0.6 && property.price != null) reasons.push('Close to budget');

  const location = scoreLocation(property.city, property.title, criteria.city, criteria.area);
  if (location.matched) reasons.push(`Location match: ${location.matched}`);

  let type = 0.5;
  if (criteria.property_type && property.type) {
    type = property.type.toLowerCase() === criteria.property_type.toLowerCase() ? 1 : 0;
    if (type === 1) reasons.push(`${titleCase(property.type)} property`);
  }

  let bedrooms = 0.5;
  if (criteria.bedrooms != null && property.bedrooms != null) {
    const diff = Math.abs(property.bedrooms - criteria.bedrooms);
    bedrooms = diff === 0 ? 1 : diff === 1 ? 0.6 : 0.2;
    if (diff === 0) reasons.push(`${property.bedrooms} BHK match`);
  }

  let requirement = 0.5;
  if (criteria.requirement_type && property.requirement_type) {
    requirement =
      property.requirement_type.toLowerCase() === criteria.requirement_type.toLowerCase() ? 1 : 0;
    if (requirement === 1) reasons.push(`Available to ${property.requirement_type}`);
  }

  // Amenities are a bonus (not weighted into the base) but enrich reasoning.
  if (criteria.amenities?.length && property.amenities.length) {
    const wanted = criteria.amenities.map((a) => a.toLowerCase());
    const have = property.amenities.map((a) => a.toLowerCase());
    const matched = wanted.filter((a) => have.some((h) => h.includes(a)));
    if (matched.length) reasons.push(`Amenities: ${matched.join(', ')}`);
  }

  const raw =
    budget * WEIGHTS.budget +
    location.score * WEIGHTS.location +
    type * WEIGHTS.type +
    bedrooms * WEIGHTS.bedrooms +
    requirement * WEIGHTS.requirement;

  return {
    property,
    score: Math.round(Math.max(0, Math.min(100, raw))),
    reasons: reasons.length ? reasons : ['Partial match on available criteria'],
  };
}

/** Rank candidate properties; returns the top N by score (desc). */
export function matchProperties(
  properties: MatchableProperty[],
  criteria: MatchCriteria,
  limit = 5,
): PropertyMatch[] {
  return properties
    .map((p) => scoreProperty(p, criteria))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
