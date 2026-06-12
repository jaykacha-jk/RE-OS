import { apiFetch } from './api';
import { getSession } from './auth';

export type ListMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

export type Conversation = {
  id: string;
  conversation_code: string;
  type: string;
  status: string;
  subject: string | null;
  property_id: string | null;
  property_slug: string | null;
  property: {
    id: string;
    property_code: string;
    title: string;
    slug: string | null;
    city: string | null;
  } | null;
  inquiry_id: string | null;
  inquiry: { id: string; inquiry_code: string; stage: string } | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  assigned_employee_id: string | null;
  assigned_employee_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  tags: string[];
  unread: boolean;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  participants?: {
    id: string;
    participant_type: string;
    user_id: string | null;
    employee_id: string | null;
    display_name: string | null;
    last_read_at: string | null;
    joined_at: string;
  }[];
};

export type Message = {
  id: string;
  sender_type: string;
  sender_id: string | null;
  sender_name: string | null;
  message_type: string;
  content: string;
  status: string;
  attachments: {
    id: string;
    url: string;
    name: string;
    content_type: string | null;
    kind: string;
    size_bytes: number | null;
  }[];
  created_at: string;
};

export type ConversationActivities = {
  activities: {
    id: string;
    activity_type: string;
    content: string | null;
    metadata: unknown;
    actor_id: string | null;
    actor_email: string | null;
    created_at: string;
  }[];
  assignments: {
    id: string;
    employee_id: string;
    employee_name: string | null;
    assigned_by: string | null;
    assigned_at: string;
  }[];
};

export const CONVERSATION_STATUSES = ['open', 'assigned', 'waiting', 'closed', 'archived'] as const;
export const CONVERSATION_TYPES = ['website', 'inquiry', 'property', 'support', 'internal'] as const;

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'open':
      return 'bg-sky-100 text-sky-800';
    case 'assigned':
      return 'bg-teal-100 text-teal-800';
    case 'waiting':
      return 'bg-amber-100 text-amber-800';
    case 'closed':
      return 'bg-slate-100 text-slate-600';
    case 'archived':
      return 'bg-slate-200 text-slate-500';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function authToken(): string | undefined {
  return getSession()?.access_token;
}

export async function fetchConversations(params: Record<string, string> = {}) {
  const token = authToken();
  if (!token) return { data: [] as Conversation[], meta: null as ListMeta | null };
  const qs = new URLSearchParams(params);
  const res = await apiFetch<Conversation[]>(`/api/v1/conversations?${qs}`, { token });
  return { data: res.data, meta: res.meta as unknown as ListMeta };
}

export async function fetchConversation(id: string) {
  const token = authToken();
  if (!token) throw new Error('Not authenticated');
  const res = await apiFetch<Conversation>(`/api/v1/conversations/${id}`, { token });
  return res.data;
}

export async function fetchUnreadConversationCount() {
  const token = authToken();
  if (!token) return 0;
  const res = await apiFetch<{ count: number }>('/api/v1/conversations/unread-count', { token });
  return res.data.count;
}

export async function fetchMessages(conversationId: string, page = 1) {
  const token = authToken();
  if (!token) return { data: [] as Message[], meta: null as ListMeta | null };
  const res = await apiFetch<Message[]>(
    `/api/v1/conversations/${conversationId}/messages?page=${page}&per_page=50`,
    { token },
  );
  return { data: res.data.reverse(), meta: res.meta as unknown as ListMeta };
}

export async function sendMessage(
  conversationId: string,
  body: { content: string; attachments?: { name: string; kind: string; content_base64: string; content_type?: string }[] },
) {
  const token = authToken();
  if (!token) throw new Error('Not authenticated');
  const res = await apiFetch<Message>(`/api/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function markMessageRead(messageId: string) {
  const token = authToken();
  if (!token) return;
  await apiFetch(`/api/v1/messages/${messageId}/read`, { method: 'PATCH', token });
}

export async function assignConversation(conversationId: string, employeeId: string) {
  const token = authToken();
  if (!token) throw new Error('Not authenticated');
  const res = await apiFetch<Conversation>(`/api/v1/conversations/${conversationId}/assign`, {
    method: 'POST',
    token,
    body: JSON.stringify({ employee_id: employeeId }),
  });
  return res.data;
}

export async function closeConversation(conversationId: string, reason?: string) {
  const token = authToken();
  if (!token) throw new Error('Not authenticated');
  const res = await apiFetch<Conversation>(`/api/v1/conversations/${conversationId}/close`, {
    method: 'POST',
    token,
    body: JSON.stringify({ reason }),
  });
  return res.data;
}

export async function convertToInquiry(conversationId: string, body: Record<string, unknown> = {}) {
  const token = authToken();
  if (!token) throw new Error('Not authenticated');
  const res = await apiFetch<Conversation>(
    `/api/v1/conversations/${conversationId}/convert-inquiry`,
    { method: 'POST', token, body: JSON.stringify(body) },
  );
  return res.data;
}

export async function fetchConversationActivities(conversationId: string) {
  const token = authToken();
  if (!token) return null;
  const res = await apiFetch<ConversationActivities>(
    `/api/v1/conversations/${conversationId}/activities`,
    { token },
  );
  return res.data;
}
