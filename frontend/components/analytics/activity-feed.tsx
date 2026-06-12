'use client';

import Link from 'next/link';

import { Icon, type IconName } from '../ui/icons';
import { useNotifications } from '../../hooks/use-notifications';
import { formatNotificationTime, type NotificationType } from '../../lib/notifications';
import { EmptyState, Skeleton } from './chart-card';

const TYPE_ICON: Record<NotificationType, IconName> = {
  SYSTEM: 'pulse',
  CRM: 'inquiries',
  PROPERTY: 'properties',
  BILLING: 'billing',
  CHAT: 'chat',
  AI_AGENT: 'ai',
};

const TYPE_TONE: Record<NotificationType, string> = {
  SYSTEM: 'bg-slate-100 text-slate-500',
  CRM: 'bg-teal-100 text-teal-700',
  PROPERTY: 'bg-blue-100 text-blue-700',
  BILLING: 'bg-purple-100 text-purple-700',
  CHAT: 'bg-emerald-100 text-emerald-700',
  AI_AGENT: 'bg-amber-100 text-amber-700',
};

/** Recent workspace activity, backed by the live notifications stream. */
export function ActivityFeed({ limit = 6 }: { limit?: number }) {
  const { items, loading } = useNotifications({ listLimit: limit });

  return (
    <section className="card flex flex-col p-5">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-h3">Activity feed</h3>
          <p className="text-caption mt-1">Latest workspace events</p>
        </div>
        <Link href="/notifications" className="text-2xs font-semibold text-teal-700 hover:underline">
          View all
        </Link>
      </header>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No activity yet" message="Lead, chat, and billing events will stream here as your team works." />
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {items.slice(0, limit).map((n) => {
            const tone = TYPE_TONE[n.type] ?? TYPE_TONE.SYSTEM;
            const icon = TYPE_ICON[n.type] ?? 'pulse';
            const body = (
              <>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                  <Icon name={icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-800">{n.title}</span>
                    {!n.is_read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" aria-label="unread" /> : null}
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-xs text-slate-500">{n.message}</span>
                </span>
                <span className="shrink-0 self-start text-2xs text-slate-400">{formatNotificationTime(n.created_at)}</span>
              </>
            );
            return (
              <li key={n.id}>
                {n.action_url ? (
                  <Link href={n.action_url} className="flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-50">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl px-2 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
