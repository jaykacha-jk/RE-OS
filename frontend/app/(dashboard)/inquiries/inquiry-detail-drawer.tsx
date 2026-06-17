'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Drawer } from '../../../components/ui';
import { apiFetch } from '../../../lib/api';
import { getSession } from '../../../lib/auth';
import {
  budgetLabel,
  humanize,
  priorityBadgeClass,
  stageBadgeClass,
  stageLabel,
  temperatureBadgeClass,
  type Inquiry,
  type InquiryHistoryEntry,
  type TimelineActivity,
} from '../../../lib/crm';
import { Timeline } from './[id]/timeline';

type InquiryDetailDrawerProps = {
  inquiryId: string | null;
  onClose: () => void;
};

type Tab = 'overview' | 'timeline' | 'notes' | 'followups' | 'audit';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'notes', label: 'Notes' },
  { key: 'followups', label: 'Follow-ups' },
  { key: 'audit', label: 'Audit' },
];

export function InquiryDetailDrawer({ inquiryId, onClose }: InquiryDetailDrawerProps) {
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [history, setHistory] = useState<InquiryHistoryEntry[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inquiryId) {
      setInquiry(null);
      setActivities([]);
      setHistory([]);
      setTab('overview');
      return;
    }

    const session = getSession();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<Inquiry>(`/api/v1/inquiries/${inquiryId}`, { token: session.access_token }),
      apiFetch<{ history: InquiryHistoryEntry[]; activities: TimelineActivity[] }>(
        `/api/v1/inquiries/${inquiryId}/history`,
        { token: session.access_token },
      ),
    ])
      .then(([detail, timeline]) => {
        setInquiry(detail.data);
        setHistory(timeline.data.history);
        setActivities(timeline.data.activities);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load inquiry'))
      .finally(() => setLoading(false));
  }, [inquiryId]);

  return (
    <Drawer
      open={Boolean(inquiryId)}
      onClose={onClose}
      title={inquiry?.client_name ?? 'Inquiry details'}
      description={inquiry ? `${inquiry.inquiry_code} · ${inquiry.phone}` : 'Loading lead context'}
      width="lg"
      footer={
        inquiry ? (
          <>
            <Link href={`/inquiries/${inquiry.id}`} className="btn-secondary">
              Open full page
            </Link>
            <Link href={`/inquiries/${inquiry.id}/edit`} className="btn-primary">
              Edit lead
            </Link>
          </>
        ) : null
      }
    >
      {loading && !inquiry ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {inquiry ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-2xs font-bold ${stageBadgeClass(inquiry.stage)}`}>
              {stageLabel(inquiry.stage)}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-2xs font-bold ${temperatureBadgeClass(inquiry.temperature)}`}>
              {humanize(inquiry.temperature)}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-2xs font-bold ${priorityBadgeClass(inquiry.priority)}`}>
              {humanize(inquiry.priority)} priority
            </span>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-reos-border">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`shrink-0 border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                  tab === item.key
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'overview' ? <Overview inquiry={inquiry} /> : null}
          {tab === 'timeline' ? <Timeline activities={activities} history={history} /> : null}
          {tab === 'notes' ? <Notes inquiry={inquiry} /> : null}
          {tab === 'followups' ? <Followups inquiry={inquiry} /> : null}
          {tab === 'audit' ? <Audit history={history} /> : null}
        </div>
      ) : null}
    </Drawer>
  );
}

function Overview({ inquiry }: { inquiry: Inquiry }) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-reos-border bg-white p-4">
        <h3 className="text-h3">Lead summary</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <Field label="Phone" value={inquiry.phone} />
          <Field label="WhatsApp" value={inquiry.whatsapp} />
          <Field label="Email" value={inquiry.email} />
          <Field label="Source" value={inquiry.source_name} />
          <Field label="Assignee" value={inquiry.assigned_employee_name} />
          <Field label="Budget" value={budgetLabel(inquiry.budget_min, inquiry.budget_max)} />
          <Field label="Requirement" value={inquiry.requirement_type ? humanize(inquiry.requirement_type) : null} />
          <Field label="Property type" value={inquiry.property_type ? humanize(inquiry.property_type) : null} />
          <Field label="Preferred location" value={inquiry.preferred_location} />
          <Field label="Timeline" value={inquiry.purchase_timeline ? humanize(inquiry.purchase_timeline) : null} />
        </dl>
      </section>

      {inquiry.property ? (
        <section className="rounded-2xl border border-reos-border bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Linked property</p>
          <Link href={`/properties/${inquiry.property.id}`} className="mt-1 block font-semibold text-teal-700 hover:underline">
            {inquiry.property.title}
          </Link>
          <p className="mt-0.5 font-mono text-2xs text-slate-500">{inquiry.property.property_code}</p>
        </section>
      ) : null}

      {inquiry.remarks ? (
        <section className="rounded-2xl border border-reos-border bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Remarks</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{inquiry.remarks}</p>
        </section>
      ) : null}
    </div>
  );
}

function Notes({ inquiry }: { inquiry: Inquiry }) {
  if (!inquiry.notes?.length) return <EmptyCopy>No notes yet.</EmptyCopy>;
  return (
    <div className="space-y-2">
      {inquiry.notes.map((note) => (
        <article key={note.id} className="rounded-2xl border border-reos-border bg-white p-4 text-sm">
          <p className="leading-6 text-slate-700">{note.note}</p>
          <p className="mt-2 text-xs text-slate-400">
            {note.created_by_email ?? 'system'} · {new Date(note.created_at).toLocaleString()}
          </p>
        </article>
      ))}
    </div>
  );
}

function Followups({ inquiry }: { inquiry: Inquiry }) {
  const hasFollowups = Boolean(inquiry.followups?.length);
  const hasVisits = Boolean(inquiry.site_visits?.length);
  if (!hasFollowups && !hasVisits) return <EmptyCopy>No follow-ups or site visits scheduled.</EmptyCopy>;

  return (
    <div className="space-y-4">
      {hasFollowups ? (
        <section>
          <h3 className="text-h3">Follow-ups</h3>
          <div className="mt-2 space-y-2">
            {inquiry.followups?.map((followup) => (
              <div key={followup.id} className="rounded-2xl border border-reos-border bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-900">{humanize(followup.followup_type)}</span>
                  <span className="badge badge-slate">{humanize(followup.status)}</span>
                </div>
                <p className="mt-1 text-slate-500">
                  {followup.followup_date}
                  {followup.followup_time ? ` ${followup.followup_time}` : ''}
                </p>
                {followup.notes ? <p className="mt-1 text-xs text-slate-500">{followup.notes}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasVisits ? (
        <section>
          <h3 className="text-h3">Site visits</h3>
          <div className="mt-2 space-y-2">
            {inquiry.site_visits?.map((visit) => (
              <div key={visit.id} className="rounded-2xl border border-reos-border bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-900">{new Date(visit.scheduled_at).toLocaleString()}</span>
                  <span className="badge badge-slate">{humanize(visit.status)}</span>
                </div>
                {visit.property ? <p className="mt-1 text-slate-500">{visit.property.title}</p> : null}
                {visit.employee_name ? <p className="mt-1 text-xs text-slate-500">with {visit.employee_name}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Audit({ history }: { history: InquiryHistoryEntry[] }) {
  if (!history.length) return <EmptyCopy>No audit entries yet.</EmptyCopy>;
  return (
    <div className="space-y-2">
      {history.map((entry) => (
        <article key={entry.id} className="rounded-2xl border border-reos-border bg-white p-4 text-sm">
          <p className="font-semibold text-slate-900">{humanize(entry.change_type)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {entry.changed_by_email ?? 'system'} · {new Date(entry.created_at).toLocaleString()}
          </p>
        </article>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{value || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

function EmptyCopy({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-reos-border bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
