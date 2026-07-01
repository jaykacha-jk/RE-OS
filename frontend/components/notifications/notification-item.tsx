'use client';

import Link from 'next/link';

import {
  formatNotificationTime,
  priorityBadgeClass,
  typeBadgeClass,
  type Notification,
} from '../../lib/notifications';
import { StatusBadge } from '../ui';

type Props = {
  notification: Notification;
  compact?: boolean;
  onMarkRead?: (id: string) => void;
};

export function NotificationItem({ notification, compact, onMarkRead }: Props) {
  const inner = (
  <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {!notification.is_read && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-teal-600" title="Unread" />
            )}
            <p className={`truncate text-sm font-medium text-slate-900 ${compact ? 'max-w-[220px]' : ''}`}>
              {notification.title}
            </p>
          </div>
          {!compact && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{notification.message}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge size="compact" label={notification.type} className={typeBadgeClass(notification.type)} />
            <StatusBadge size="compact" label={notification.priority} className={priorityBadgeClass(notification.priority)} />
            <span className="text-xs text-slate-400">{formatNotificationTime(notification.created_at)}</span>
          </div>
        </div>
        {!notification.is_read && onMarkRead && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            className="shrink-0 text-xs text-teal-700 hover:underline"
          >
            Mark read
          </button>
        )}
      </div>
    </>
  );

  const href = notification.action_url
    ? notification.action_url.startsWith('/')
      ? notification.action_url
      : `/notifications/${notification.id}`
    : `/notifications/${notification.id}`;

  return (
    <Link
      href={href}
      className={`block rounded-lg border border-transparent px-3 py-2.5 transition hover:border-slate-200 hover:bg-slate-50 ${
        notification.is_read ? 'opacity-75' : 'bg-white'
      }`}
    >
      {inner}
    </Link>
  );
}
