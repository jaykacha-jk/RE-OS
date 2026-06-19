/** Organization tier codes stored on `organizations.tier` — align with `subscription_plans.code`. */
export const ORG_TIER_CODES = ['starter', 'pro', 'enterprise'] as const;
export type OrgTierCode = (typeof ORG_TIER_CODES)[number];

const LEGACY_TIER_ALIASES: Record<string, OrgTierCode> = {
  basic: 'starter',
};

export function normalizeOrgTier(tier: string): string {
  return LEGACY_TIER_ALIASES[tier] ?? tier;
}

/** Map organization tier to subscription plan code (1:1 for seeded tiers). */
export function tierToPlanCode(tier: string): string {
  return normalizeOrgTier(tier);
}
