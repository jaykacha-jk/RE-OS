'use client';

import Link from 'next/link';

import type { QuotaResource } from '../../lib/quota';

type QuotaNoticeProps = {
  title: string;
  message: string;
  upgradeHref?: string;
  upgradeLabel?: string;
  /** warning = proactive amber; error = API rejection rose */
  tone?: 'warning' | 'error';
};

export function QuotaNotice({
  title,
  message,
  upgradeHref = '/billing/plans',
  upgradeLabel = 'View plans',
  tone = 'warning',
}: QuotaNoticeProps) {
  const styles =
    tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : 'border-amber-200 bg-amber-50 text-amber-950';

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-6">{message}</p>
      <Link href={upgradeHref} className="mt-2 inline-flex text-sm font-bold text-teal-700 hover:underline">
        {upgradeLabel}
      </Link>
    </div>
  );
}

export function proactiveQuotaNoticeProps(
  resource: QuotaResource,
  planName: string,
  message: string,
): QuotaNoticeProps {
  const titles: Record<QuotaResource, string> = {
    properties: 'Property limit reached',
    employees: 'Employee limit reached',
    storage_bytes: 'Storage limit reached',
    ai_minutes: 'AI minutes unavailable',
  };

  return {
    title: titles[resource],
    message: message || `Upgrade from ${planName} to add more ${resource === 'storage_bytes' ? 'storage' : resource}.`,
    tone: 'warning',
  };
}

export function quotaApiNoticeProps(details: {
  code: string;
  message: string;
  upgradeHref: string;
  ruleId?: string;
}): QuotaNoticeProps {
  const title =
    details.code === 'ORG_READ_ONLY'
      ? 'Organization is read-only'
      : details.ruleId === 'BR-T04'
        ? 'Plan limit reached'
        : 'Action blocked';

  return {
    title,
    message: details.message,
    upgradeHref: details.upgradeHref,
    upgradeLabel: details.code === 'ORG_READ_ONLY' ? 'Restore access' : 'Upgrade plan',
    tone: 'error',
  };
}
