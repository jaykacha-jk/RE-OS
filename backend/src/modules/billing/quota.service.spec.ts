import { UnprocessableEntityException } from '@nestjs/common';

import { QuotaService } from './quota.service';

describe('QuotaService', () => {
  const starterPlan = {
    id: 'plan-starter',
    code: 'starter',
    name: 'Starter',
    max_properties: 100,
    max_employees: 5,
    storage_limit_bytes: 5_368_709_120n,
    max_ai_minutes_monthly: 0,
    is_active: true,
  };

  const org = {
    id: 'org-1',
    status: 'active',
    tier: 'starter',
    organization_usage: {
      tenant_id: 'org-1',
      properties_count: 100,
      employees_count: 2,
      storage_bytes: 1000n,
      ai_minutes_used: 0,
    },
  };

  function build(overrides: {
    org?: typeof org;
    subscription?: { status: string; plan: typeof starterPlan } | null;
    tierPlan?: typeof starterPlan | null;
  } = {}) {
    const repo = {
      findOrganization: jest.fn().mockResolvedValue(overrides.org ?? org),
      findCurrentSubscription: jest.fn().mockResolvedValue(overrides.subscription ?? null),
      findPlanByCode: jest.fn().mockResolvedValue(overrides.tierPlan ?? starterPlan),
      adjustStorageBytes: jest.fn().mockResolvedValue(undefined),
      incrementAiMinutes: jest.fn().mockResolvedValue(undefined),
    };
    return { service: new QuotaService(repo as never), repo };
  }

  it('prefers active subscription plan over organization tier', async () => {
    const proPlan = { ...starterPlan, code: 'pro', max_properties: 1000 };
    const { service } = build({
      subscription: { status: 'active', plan: proPlan },
    });

    const ctx = await service.getContext('org-1');
    expect(ctx.plan.code).toBe('pro');
  });

  it('blocks property create when at limit (BR-T04)', async () => {
    const { service } = build();
    await expect(service.assertCanCreateProperty('org-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'QUOTA_EXCEEDED', rule_id: 'BR-T04' }),
    });
  });

  it('blocks creates for suspended orgs (BR-T02)', async () => {
    const { service } = build({ org: { ...org, status: 'suspended' } });
    await expect(service.assertCanCreateEmployee('org-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ORG_READ_ONLY', rule_id: 'BR-T02' }),
    });
  });

  it('blocks AI when plan includes zero minutes', async () => {
    const { service } = build();
    await expect(service.assertAiMinutesAvailable('org-1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('blocks storage when upload exceeds limit', async () => {
    const { service } = build({
      org: {
        ...org,
        organization_usage: {
          ...org.organization_usage,
          storage_bytes: BigInt(starterPlan.storage_limit_bytes) - 100n,
        },
      },
    });

    await expect(service.assertStorageAvailable('org-1', 200)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'QUOTA_EXCEEDED', resource: 'storage_bytes' }),
    });
  });
});
