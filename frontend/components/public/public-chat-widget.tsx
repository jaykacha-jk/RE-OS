'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { API_BASE } from '../../lib/public-site';

type WidgetSession = {
  conversationId: string;
  token: string;
};

type PublicMessage = {
  id: string;
  sender_type: string;
  sender_name: string | null;
  content: string;
  created_at: string;
};

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function storageKey(tenant: string) {
  return `reos_public_chat:${tenant}`;
}

function visitorKey(tenant: string) {
  return `reos_public_chat_visitor:${tenant}`;
}

function propertySlugFromPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'listings' && parts[1]) return parts[1];
  if (['buy', 'rent', 'commercial'].includes(parts[0]) && parts[2]) return parts[2];
  return null;
}

export function PublicChatWidget() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const tenant = searchParams.get('tenant') ?? 'demo';
  const propertySlug = useMemo(() => propertySlugFromPath(pathname), [pathname]);

  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<WidgetSession | null>(null);
  const [visitorId, setVisitorId] = useState('');
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedVisitor = localStorage.getItem(visitorKey(tenant)) ?? randomId();
    localStorage.setItem(visitorKey(tenant), storedVisitor);
    setVisitorId(storedVisitor);

    const storedSession = localStorage.getItem(storageKey(tenant));
    if (storedSession) {
      try {
        setSession(JSON.parse(storedSession) as WidgetSession);
      } catch {
        localStorage.removeItem(storageKey(tenant));
      }
    }
  }, [tenant]);

  useEffect(() => {
    if (!open || !session) return;
    const activeSession = session;

    let cancelled = false;
    async function loadMessages() {
      const res = await fetch(
        `${API_BASE}/api/v1/public/chat/conversations/${activeSession.conversationId}/messages?token=${encodeURIComponent(
          activeSession.token,
        )}`,
      );
      if (!res.ok) return;
      const body = (await res.json()) as { data: PublicMessage[] };
      if (!cancelled) setMessages(body.data);
    }

    loadMessages();
    const interval = window.setInterval(loadMessages, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [open, session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;

    setBusy(true);
    setError(null);
    try {
      if (!session) {
        const res = await fetch(`${API_BASE}/api/v1/public/chat/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant,
            client_identifier: visitorId || randomId(),
            client_name: name.trim() || undefined,
            client_phone: phone.trim() || undefined,
            property_slug: propertySlug ?? undefined,
            message: content,
          }),
        });
        if (!res.ok) throw new Error('Unable to start chat');
        const body = (await res.json()) as {
          data: { conversation: { id: string }; token: string };
        };
        const nextSession = {
          conversationId: body.data.conversation.id,
          token: body.data.token,
        };
        localStorage.setItem(storageKey(tenant), JSON.stringify(nextSession));
        setSession(nextSession);
        setMessages([
          {
            id: 'optimistic-initial',
            sender_type: 'client',
            sender_name: name.trim() || 'You',
            content,
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        const res = await fetch(
          `${API_BASE}/api/v1/public/chat/conversations/${session.conversationId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({ content }),
          },
        );
        if (!res.ok) throw new Error('Unable to send message');
        const body = (await res.json()) as { data: PublicMessage };
        setMessages((items) => [...items, body.data]);
      }
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat is unavailable right now');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="mb-3 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="bg-slate-950 px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold">Chat with us</p>
                <p className="mt-1 text-xs text-slate-300">Ask about listings, visits, or availability.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Close chat"
              >
                ×
              </button>
            </div>
          </div>

          <div className="max-h-72 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            {messages.length ? (
              messages.map((message) => {
                const mine = message.sender_type === 'client';
                return (
                  <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                        mine ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 shadow-sm'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl bg-white p-4 text-sm leading-6 text-slate-600 shadow-sm">
                Hi! Share what you are looking for and our team will respond here.
              </div>
            )}
          </div>

          <form onSubmit={submit} className="space-y-3 border-t border-slate-200 p-4">
            {!session ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Name"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+91 phone"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </div>
            ) : null}
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type your message..."
              rows={3}
              className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
            {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
            <button type="submit" disabled={busy || !draft.trim()} className="btn-primary w-full justify-center py-2.5">
              {busy ? 'Sending...' : session ? 'Send message' : 'Start chat'}
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow-2xl transition hover:bg-teal-800"
      >
        {open ? 'Close chat' : 'Chat'}
      </button>
    </div>
  );
}
