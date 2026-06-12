import { apiFetch } from './api';
import { getSession } from './auth';

export type NotificationType =
  | 'SYSTEM'
  | 'CRM'
  | 'PROPERTY'
  | 'BILLING'
  | 'CHAT'
  | 'AI_AGENT';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  channel: string;
  event_key: string | null;
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: unknown;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

export type NotificationPreference = {
  event_key: string;
  label: string;
  type: string;
  in_app: boolean;
  email: boolean;
};

export type ListMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

function token() {
  return getSession()?.access_token;
}

export async function fetchNotifications(opts?: {
  page?: number;
  per_page?: number;
  type?: string;
  is_read?: boolean;
}): Promise<{ data: Notification[]; meta: ListMeta }> {
  const t = token();
  if (!t) return { data: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 1 } };

  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.per_page) params.set('per_page', String(opts.per_page));
  if (opts?.type) params.set('filter[type]', opts.type);
  if (opts?.is_read !== undefined) params.set('filter[is_read]', String(opts.is_read));

  const qs = params.toString();
  const res = await apiFetch<Notification[]>(
    `/api/v1/notifications${qs ? `?${qs}` : ''}`,
    { token: t },
  );
  return {
    data: res.data,
    meta: (res.meta ?? { page: 1, per_page: 20, total: 0, total_pages: 1 }) as ListMeta,
  };
}

export async function fetchUnreadCount(): Promise<number> {
  const t = token();
  if (!t) return 0;
  const res = await apiFetch<{ unread_count: number }>(
    '/api/v1/notifications/unread-count',
    { token: t },
  );
  return res.data.unread_count;
}

export async function markNotificationRead(id: string): Promise<void> {
  const t = token();
  if (!t) return;
  await apiFetch(`/api/v1/notifications/${id}/read`, {
    method: 'PATCH',
    token: t,
  });
}

export async function markAllNotificationsRead(): Promise<number> {
  const t = token();
  if (!t) return 0;
  const res = await apiFetch<{ updated: number }>('/api/v1/notifications/read-all', {
    method: 'PATCH',
    token: t,
  });
  return res.data.updated;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreference[]> {
  const t = token();
  if (!t) return [];
  const res = await apiFetch<NotificationPreference[]>('/api/v1/notification-preferences', {
    token: t,
  });
  return res.data;
}

export async function updateNotificationPreferences(
  preferences: Pick<NotificationPreference, 'event_key' | 'in_app' | 'email'>[],
): Promise<NotificationPreference[]> {
  const t = token();
  if (!t) return [];
  const res = await apiFetch<NotificationPreference[]>('/api/v1/notification-preferences', {
    method: 'PATCH',
    token: t,
    body: JSON.stringify({ preferences }),
  });
  return res.data;
}

export function priorityBadgeClass(priority: NotificationPriority): string {
  switch (priority) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800';
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function typeBadgeClass(type: NotificationType): string {
  switch (type) {
    case 'CRM':
      return 'bg-teal-100 text-teal-800';
    case 'PROPERTY':
      return 'bg-blue-100 text-blue-800';
    case 'BILLING':
      return 'bg-purple-100 text-purple-800';
    case 'SYSTEM':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function formatNotificationTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export type NotificationGroup = 'Today' | 'Yesterday' | 'Older';

export function groupNotifications(items: Notification[]): Record<NotificationGroup, Notification[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const groups: Record<NotificationGroup, Notification[]> = {
    Today: [],
    Yesterday: [],
    Older: [],
  };

  for (const n of items) {
    const created = new Date(n.created_at);
    if (created >= startOfToday) groups.Today.push(n);
    else if (created >= startOfYesterday) groups.Yesterday.push(n);
    else groups.Older.push(n);
  }
  return groups;
}
