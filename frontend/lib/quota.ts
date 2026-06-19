import { ApiError } from './api';
import type { BillingUsage } from './billing';

export const UNLIMITED_COUNT_LIMIT = 2_147_483_647;

export type QuotaResource = 'properties' | 'employees' | 'storage_bytes' | 'ai_minutes';

export type QuotaErrorDetails = {
  code: string;
  message: string;
  upgradeHref: string;
  ruleId?: string;
};

export function isUnlimitedCountLimit(limit: number): boolean {
  return limit <= 0 || limit >= UNLIMITED_COUNT_LIMIT;
}

export function isAtCountLimit(used: number, limit: number): boolean {
  if (isUnlimitedCountLimit(limit)) return false;
  return used >= limit;
}

export function quotaUsagePercent(used: number, limit: number): number {
  if (isUnlimitedCountLimit(limit)) return 0;
  return Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
}

export function resourceAtLimit(usage: BillingUsage, resource: QuotaResource): boolean {
  switch (resource) {
    case 'properties':
      return isAtCountLimit(usage.usage.properties, usage.limits.properties);
    case 'employees':
      return isAtCountLimit(usage.usage.employees, usage.limits.employees);
    case 'ai_minutes':
      return usage.limits.ai_minutes <= 0 || isAtCountLimit(usage.usage.ai_minutes, usage.limits.ai_minutes);
    case 'storage_bytes':
      if (usage.limits.storage_bytes <= 0) return false;
      return usage.usage.storage_bytes >= usage.limits.storage_bytes;
    default:
      return false;
  }
}

export function quotaLimitLabel(resource: QuotaResource): string {
  switch (resource) {
    case 'properties':
      return 'property';
    case 'employees':
      return 'employee';
    case 'storage_bytes':
      return 'storage';
    case 'ai_minutes':
      return 'AI minutes';
    default:
      return 'resource';
  }
}

export function proactiveQuotaMessage(resource: QuotaResource, usage: BillingUsage): string {
  const label = quotaLimitLabel(resource);
  const used =
    resource === 'properties'
      ? usage.usage.properties
      : resource === 'employees'
        ? usage.usage.employees
        : 0;
  const limit =
    resource === 'properties'
      ? usage.limits.properties
      : resource === 'employees'
        ? usage.limits.employees
        : 0;

  if (resource === 'ai_minutes' && usage.limits.ai_minutes <= 0) {
    return `Your ${usage.plan.name} plan does not include AI minutes. Upgrade to use AI features.`;
  }

  if (isUnlimitedCountLimit(limit)) {
    return '';
  }

  return `You have used ${used.toLocaleString('en-IN')} of ${limit.toLocaleString('en-IN')} ${label} slots on the ${usage.plan.name} plan.`;
}

const QUOTA_CODES = new Set(['QUOTA_EXCEEDED', 'ORG_READ_ONLY', 'BUSINESS_RULE_VIOLATION']);

export function parseQuotaApiError(err: unknown, fallbackUpgradeHref = '/billing/plans'): QuotaErrorDetails | null {
  if (!(err instanceof ApiError)) return null;

  const body = err.body as
    | {
        error?: { code?: string; message?: string; rule_id?: string };
        code?: string;
        message?: string;
        rule_id?: string;
        upgrade_url?: string;
      }
    | undefined;

  const nested = body?.error;
  const code = nested?.code ?? body?.code;
  const message = nested?.message ?? body?.message ?? err.message;
  const ruleId = nested?.rule_id ?? body?.rule_id;
  const upgradeUrl = body?.upgrade_url;

  const looksLikeQuota =
    (code && QUOTA_CODES.has(code)) ||
    /quota exceeded|read-only mode|not included on your current plan/i.test(message);

  if (!looksLikeQuota) return null;

  return {
    code: code ?? 'QUOTA_EXCEEDED',
    message,
    ruleId,
    upgradeHref: upgradeUrl?.startsWith('/') ? upgradeUrl : fallbackUpgradeHref,
  };
}
