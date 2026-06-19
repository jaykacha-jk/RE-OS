import { normalizeOrgTier, tierToPlanCode } from './org-tier';

describe('org-tier', () => {
  it('normalizes legacy basic tier to starter', () => {
    expect(normalizeOrgTier('basic')).toBe('starter');
    expect(tierToPlanCode('basic')).toBe('starter');
  });

  it('passes through starter/pro/enterprise', () => {
    expect(tierToPlanCode('pro')).toBe('pro');
  });
});
