'use client';

import { useCallback, useEffect, useState } from 'react';

import { NotificationItem } from '../../../components/notifications/notification-item';
import { getSession, hasPermission } from '../../../lib/auth';
import {
  fetchNotifications,
  groupNotifications,
  type ListMeta,
  type Notification,
} from '../../../lib/notifications';
import { useNotifications } from '../../../hooks/use-notifications';

export default function NotificationsPage() {
  const { markRead, markAllRead, unreadCount } = useNotifications({ listLimit: 50 });
  const [rows, setRows] = useState<Notification[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all');
  const [filterType, setFilterType] = useState('');

  const canRead = hasPermission(getSession(), 'notifications.read');

  const load = useCallback(
    async (page = 1) => {
      if (!canRead) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetchNotifications({
          page,
          per_page: 30,
          type: filterType || undefined,
          is_read:
            filterRead === 'all' ? undefined : filterRead === 'read',
        });
        setRows(res.data);
        setMeta(res.meta);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [canRead, filterRead, filterType],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  if (!canRead) {
    return (
      <p className="text-slate-600">You do not have permission to view notifications.</p>
    );
  }

  const groups = groupNotifications(rows);
  const groupOrder = ['Today', 'Yesterday', 'Older'] as const;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead().then(() => load(1))}
            className="rounded-lg border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={filterRead}
          onChange={(e) => setFilterRead(e.target.value as typeof filterRead)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="all">All</option>
          <option value="unread">Unread only</option>
          <option value="read">Read only</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">All types</option>
          <option value="CRM">CRM</option>
          <option value="PROPERTY">Property</option>
          <option value="SYSTEM">System</option>
          <option value="BILLING">Billing</option>
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-500">
          No notifications match your filters.
        </div>
      )}

      {!loading &&
        groupOrder.map((label) => {
          const groupItems = groups[label];
          if (!groupItems.length) return null;
          return (
            <section key={label} className="mb-8">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </h2>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {groupItems.map((n) => (
                  <div key={n.id} className="px-1">
                    <NotificationItem
                      notification={n}
                      onMarkRead={(id) => void markRead(id).then(() => load(meta?.page ?? 1))}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}

      {meta && meta.total_pages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            disabled={meta.page <= 1}
            onClick={() => void load(meta.page - 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-2 py-1 text-sm text-slate-600">
            Page {meta.page} of {meta.total_pages}
          </span>
          <button
            type="button"
            disabled={meta.page >= meta.total_pages}
            onClick={() => void load(meta.page + 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
