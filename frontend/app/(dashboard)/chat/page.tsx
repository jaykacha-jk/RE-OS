'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import { ChatAssignModal } from '../../../components/chat/assign-modal';
import { useChatSocket } from '../../../hooks/use-chat-socket';
import { getSession, hasPermission } from '../../../lib/auth';
import {
  assignConversation,
  closeConversation,
  convertToInquiry,
  fetchConversation,
  fetchConversationActivities,
  fetchConversations,
  fetchMessages,
  fetchUnreadConversationCount,
  markMessageRead,
  sendMessage,
  statusBadgeClass,
  type Conversation,
  type ConversationActivities,
  type Message,
} from '../../../lib/chat';
import { fetchEmployees, type EmployeeOption } from '../../../lib/crm-api';

export default function ChatInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activities, setActivities] = useState<ConversationActivities | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [typing, setTyping] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAssign = hasPermission(getSession(), 'chat.conversations.assign');
  const canConvert = hasPermission(getSession(), 'chat.conversations.convert');
  const canSend = hasPermission(getSession(), 'chat.messages.send');
  const canClose = hasPermission(getSession(), 'chat.conversations.update');

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const params: Record<string, string> = { per_page: '50', sort_by: 'last_message_at', sort_dir: 'desc' };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params['filter[status]'] = statusFilter;
      if (unreadOnly) params['filter[unread]'] = 'true';
      const [list, count] = await Promise.all([fetchConversations(params), fetchUnreadConversationCount()]);
      setConversations(list.data);
      setUnreadTotal(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversations');
    } finally {
      setLoadingList(false);
    }
  }, [search, statusFilter, unreadOnly]);

  const loadThread = useCallback(async (id: string) => {
    setLoadingThread(true);
    try {
      const [conv, msgs, acts] = await Promise.all([
        fetchConversation(id),
        fetchMessages(id),
        fetchConversationActivities(id),
      ]);
      setActive(conv);
      setMessages(msgs.data);
      setActivities(acts);
      // Mark latest inbound message read
      const session = getSession();
      const lastInbound = [...msgs.data].reverse().find((m) => m.sender_id !== session?.user.id);
      if (lastInbound) void markMessageRead(lastInbound.id).catch(() => undefined);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unread: false } : c)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversation');
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
    fetchEmployees().then(setEmployees).catch(() => undefined);
  }, [loadList]);

  useEffect(() => {
    if (activeId) void loadThread(activeId);
    else {
      setActive(null);
      setMessages([]);
      setActivities(null);
    }
  }, [activeId, loadThread]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const { emitTyping } = useChatSocket(
    activeId,
    {
      onMessage: (conversationId, message) => {
        if (conversationId === activeId) {
          setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
          const session = getSession();
          if (message.sender_id !== session?.user.id) {
            void markMessageRead(message.id).catch(() => undefined);
          }
        }
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  last_message_at: message.created_at,
                  last_message_preview: message.content.slice(0, 200),
                  unread: conversationId !== activeId,
                }
              : c,
          );
          return [...updated].sort(
            (a, b) =>
              new Date(b.last_message_at ?? b.created_at).getTime() -
              new Date(a.last_message_at ?? a.created_at).getTime(),
          );
        });
      },
      onConversationUpdated: (conv) => {
        setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c)));
        if (conv.id === activeId) setActive(conv);
      },
      onTyping: (conversationId, _userId, isTyping) => {
        if (conversationId === activeId) setTyping(isTyping);
      },
      onUnreadCount: (count) => setUnreadTotal(count),
    },
    true,
  );

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!activeId || !draft.trim() || !canSend) return;
    setSending(true);
    try {
      const msg = await sendMessage(activeId, { content: draft.trim() });
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setDraft('');
      emitTyping(activeId, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  async function handleFile(files: FileList | null) {
    if (!activeId || !files?.length || !canSend) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const kind = file.type.startsWith('image/') ? 'image' : 'file';
      try {
        const msg = await sendMessage(activeId, {
          content: file.name,
          attachments: [{ name: file.name, kind, content_base64: base64, content_type: file.type }],
        });
        setMessages((prev) => [...prev, msg]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Chat Inbox</h1>
          <p className="text-sm text-slate-500">
            {unreadTotal > 0 ? `${unreadTotal} unread conversation${unreadTotal === 1 ? '' : 's'}` : 'All caught up'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Conversation list */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200">
          <div className="space-y-2 border-b border-slate-200 p-3">
            <input
              type="search"
              placeholder="Search clients, code…"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void loadList()}
            />
            <div className="flex gap-2">
              <select
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="waiting">Waiting</option>
                <option value="closed">Closed</option>
              </select>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
                Unread
              </label>
            </div>
            <button
              type="button"
              onClick={() => void loadList()}
              className="w-full rounded bg-slate-100 py-1 text-xs text-slate-700 hover:bg-slate-200"
            >
              Apply filters
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <p className="p-4 text-sm text-slate-500">Loading…</p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No conversations yet.</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`w-full border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50 ${
                    activeId === c.id ? 'bg-teal-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${c.unread ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>
                      {c.client_name ?? c.subject ?? c.conversation_code}
                    </p>
                    {c.unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-600" />}
                  </div>
                  <p className="truncate text-xs text-slate-500">{c.last_message_preview ?? 'No messages'}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${statusBadgeClass(c.status)}`}>
                      {c.status}
                    </span>
                    {c.assigned_employee_name && (
                      <span className="truncate text-[10px] text-slate-400">{c.assigned_employee_name}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Message thread */}
        <section className="flex min-w-0 flex-1 flex-col">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-slate-500">Select a conversation</div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{active.client_name ?? active.conversation_code}</p>
                  <p className="text-xs text-slate-500">{active.conversation_code}</p>
                </div>
                <div className="flex gap-2">
                  {canAssign && active.status !== 'closed' && active.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => setShowAssign(true)}
                      className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                    >
                      Assign
                    </button>
                  )}
                  {canClose && active.status !== 'closed' && active.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => void closeConversation(active.id).then(() => loadThread(active.id))}
                      className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                    >
                      Close
                    </button>
                  )}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4">
                {loadingThread ? (
                  <p className="text-sm text-slate-500">Loading messages…</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((m) => {
                      const mine = m.sender_id === getSession()?.user.id;
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                              mine ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-900'
                            }`}
                          >
                            {!mine && m.sender_name && (
                              <p className="mb-0.5 text-[10px] font-medium opacity-70">{m.sender_name}</p>
                            )}
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            {m.attachments.map((a) => (
                              <a
                                key={a.id}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`mt-1 block text-xs underline ${mine ? 'text-teal-100' : 'text-teal-700'}`}
                              >
                                {a.name}
                              </a>
                            ))}
                            <p className={`mt-1 text-[10px] ${mine ? 'text-teal-200' : 'text-slate-400'}`}>
                              {new Date(m.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {typing && <p className="text-xs text-slate-400">Typing…</p>}
                    <div ref={threadEndRef} />
                  </div>
                )}
              </div>

              {canSend && active.status !== 'closed' && active.status !== 'archived' && (
                <form onSubmit={handleSend} className="border-t border-slate-200 p-3">
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      onChange={(e) => void handleFile(e.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded border border-slate-300 px-2 text-sm text-slate-600 hover:bg-slate-50"
                      title="Attach file"
                    >
                      📎
                    </button>
                    <input
                      className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Type a message…"
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        if (activeId) emitTyping(activeId, e.target.value.length > 0);
                      }}
                      onBlur={() => activeId && emitTyping(activeId, false)}
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="rounded bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>

        {/* Info sidebar */}
        {active && (
          <aside className="hidden w-72 shrink-0 flex-col border-l border-slate-200 p-4 lg:flex">
            <h3 className="text-sm font-semibold text-slate-900">Details</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Client</dt>
                <dd>{active.client_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Email</dt>
                <dd>{active.client_email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd>{active.client_phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Assignee</dt>
                <dd>{active.assigned_employee_name ?? 'Unassigned'}</dd>
              </div>
              {active.property && (
                <div>
                  <dt className="text-xs text-slate-500">Property</dt>
                  <dd>
                    <Link href={`/properties/${active.property.id}`} className="text-teal-700 hover:underline">
                      {active.property.title}
                    </Link>
                  </dd>
                </div>
              )}
              {active.inquiry ? (
                <div>
                  <dt className="text-xs text-slate-500">Inquiry</dt>
                  <dd>
                    <Link href={`/inquiries/${active.inquiry.id}`} className="text-teal-700 hover:underline">
                      {active.inquiry.inquiry_code}
                    </Link>
                  </dd>
                </div>
              ) : canConvert ? (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      void convertToInquiry(active.id).then(() => loadThread(active.id)).catch((e) =>
                        setError(e instanceof Error ? e.message : 'Convert failed'),
                      )
                    }
                    className="w-full rounded bg-teal-700 px-3 py-2 text-xs text-white hover:bg-teal-800"
                  >
                    Convert to inquiry
                  </button>
                </div>
              ) : null}
            </dl>

            {activities && activities.activities.length > 0 && (
              <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
                <h4 className="text-xs font-semibold uppercase text-slate-500">Activity</h4>
                <ul className="mt-2 space-y-2">
                  {activities.activities.slice(0, 8).map((a) => (
                    <li key={a.id} className="text-xs text-slate-600">
                      <span className="font-medium">{a.activity_type.replace(/_/g, ' ')}</span>
                      {a.content && <span> — {a.content}</span>}
                      <br />
                      <span className="text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>

      {showAssign && active && (
        <ChatAssignModal
          employees={employees}
          onAssign={(employeeId) => assignConversation(active.id, employeeId).then(() => loadThread(active.id))}
          onClose={() => setShowAssign(false)}
        />
      )}
    </div>
  );
}
