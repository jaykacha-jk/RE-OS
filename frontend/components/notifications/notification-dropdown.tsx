'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { groupNotifications } from '../../lib/notifications';
import { useNotifications } from '../../hooks/use-notifications';
import { NotificationItem } from './notification-item';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function NotificationDropdown({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications({
    enabled: open,
    listLimit: 15,
  });

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onClose]);

  if (!open) return null;

  const groups = groupNotifications(items);
  const groupOrder = ['Today', 'Yesterday', 'Older'] as const;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-[380px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          {unreadCount > 0 && (
            <p className="text-xs text-slate-500">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs font-medium text-teal-700 hover:underline"
            >
              Mark all read
            </button>
          )}
          <Link
            href="/notifications"
            onClick={onClose}
            className="text-xs font-medium text-slate-600 hover:underline"
          >
            View all
          </Link>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-2">
        {loading && (
          <p className="px-3 py-6 text-center text-sm text-slate-500">Loading…</p>
        )}
        {!loading && items.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-slate-500">
            You&apos;re all caught up — no notifications yet.
          </p>
        )}
        {!loading &&
          groupOrder.map((label) => {
            const groupItems = groups[label];
            if (!groupItems.length) return null;
            return (
              <div key={label} className="mb-2">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {label}
                </p>
                <div className="space-y-0.5">
                  {groupItems.map((n) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      compact
                      onMarkRead={(id) => void markRead(id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      <div className="border-t border-slate-100 px-4 py-2">
        <Link
          href="/settings/notifications"
          onClick={onClose}
          className="block text-center text-xs text-slate-500 hover:text-teal-700"
        >
          Notification settings
        </Link>
      </div>
    </div>
  );
}
