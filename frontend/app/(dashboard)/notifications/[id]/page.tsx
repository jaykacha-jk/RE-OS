'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { StatusBadge } from '../../../../components/ui';
import { apiFetch } from '../../../../lib/api';
import { getSession, hasPermission } from '../../../../lib/auth';
import {
  formatNotificationTime,
  markNotificationRead,
  priorityBadgeClass,
  typeBadgeClass,
  type Notification,
} from '../../../../lib/notifications';

export default function NotificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canRead = hasPermission(getSession(), 'notifications.read');

  const load = useCallback(async () => {
    const session = getSession();
    if (!session?.access_token || !canRead) {
      setLoading(false);
      return;
    }
    try {
      // List endpoint is paginated; fetch recent and find by id (no single-get API yet).
      const res = await apiFetch<Notification[]>('/api/v1/notifications?per_page=100', {
        token: session.access_token,
      });
      const found = res.data.find((n) => n.id === id);
      if (!found) {
        setError('Notification not found');
        setNotification(null);
        return;
      }
      setNotification(found);
      if (!found.is_read) {
        await markNotificationRead(id);
        setNotification({ ...found, is_read: true, read_at: new Date().toISOString() });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [canRead, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canRead) {
    return <p className="text-slate-600">You do not have permission to view this notification.</p>;
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;

  if (error || !notification) {
    return (
      <div>
        <p className="text-red-600">{error ?? 'Not found'}</p>
        <Link href="/notifications" className="mt-4 inline-block text-sm text-teal-700 hover:underline">
          ← Back to notifications
        </Link>
      </div>
    );
  }

  const actionHref = notification.action_url?.startsWith('/')
    ? notification.action_url
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/notifications" className="text-sm text-teal-700 hover:underline">
        ← All notifications
      </Link>

      <article className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusBadge size="compact" label={notification.type} className={typeBadgeClass(notification.type)} />
          <StatusBadge size="compact" label={notification.priority} className={priorityBadgeClass(notification.priority)} />
          <span className="text-xs text-slate-400">{formatNotificationTime(notification.created_at)}</span>
        </div>

        <h1 className="text-xl font-semibold text-slate-900">{notification.title}</h1>
        <p className="mt-3 whitespace-pre-wrap text-slate-700">{notification.message}</p>

        {notification.event_key && (
          <p className="mt-4 text-xs text-slate-400">Event: {notification.event_key}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {actionHref && (
            <Link
              href={actionHref}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              View related record
            </Link>
          )}
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Go back
          </button>
        </div>
      </article>
    </div>
  );
}
