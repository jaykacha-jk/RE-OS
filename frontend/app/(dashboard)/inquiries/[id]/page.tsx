'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession, hasPermission } from '../../../../lib/auth';
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
} from '../../../../lib/crm';
import { AssignModal } from './assign-modal';
import { FollowupModal } from './followup-modal';
import { SiteVisitModal } from './site-visit-modal';
import { StageModal } from './stage-modal';
import { Timeline } from './timeline';

type ModalKind = 'stage' | 'assign' | 'followup' | 'site-visit' | null;

export default function InquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [history, setHistory] = useState<InquiryHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);

  const [newNote, setNewNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [perms, setPerms] = useState({
    update: false,
    delete: false,
    assign: false,
    notes: false,
    followups: false,
    siteVisits: false,
  });

  useEffect(() => {
    const session = getSession();
    setPerms({
      update: hasPermission(session, 'crm.inquiries.update'),
      delete: hasPermission(session, 'crm.inquiries.delete'),
      assign: hasPermission(session, 'crm.inquiries.assign'),
      notes: hasPermission(session, 'crm.notes.create'),
      followups: hasPermission(session, 'crm.followups.create'),
      siteVisits: hasPermission(session, 'crm.sitevisits.create'),
    });
  }, []);

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<Inquiry>(`/api/v1/inquiries/${id}`, { token: session.access_token }),
      apiFetch<{ history: InquiryHistoryEntry[]; activities: TimelineActivity[] }>(
        `/api/v1/inquiries/${id}/history`,
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
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addNote() {
    const session = getSession();
    if (!session?.access_token || !newNote.trim()) return;
    setNoteSaving(true);
    try {
      await apiFetch(`/api/v1/inquiries/${id}/notes`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({ note: newNote.trim() }),
      });
      setNewNote('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setNoteSaving(false);
    }
  }

  async function updateFollowupStatus(followupId: string, status: string) {
    const session = getSession();
    if (!session?.access_token) return;
    try {
      await apiFetch(`/api/v1/inquiries/${id}/followups/${followupId}`, {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify({ status }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update follow-up');
    }
  }

  async function updateSiteVisitStatus(visitId: string, status: string) {
    const session = getSession();
    if (!session?.access_token) return;
    try {
      await apiFetch(`/api/v1/inquiries/${id}/site-visits/${visitId}`, {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify({ status }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update site visit');
    }
  }

  async function remove() {
    const session = getSession();
    if (!session?.access_token) return;
    if (!confirm('Soft delete this inquiry? It will be removed from active lists.')) return;
    try {
      await apiFetch(`/api/v1/inquiries/${id}`, { method: 'DELETE', token: session.access_token });
      router.push('/inquiries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inquiry');
    }
  }

  if (loading && !inquiry) return <p className="text-slate-500">Loading…</p>;
  if (error && !inquiry) return <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!inquiry) return null;

  return (
    <div>
      <Link href="/inquiries" className="text-sm text-teal-700 hover:underline">
        ← Back to inquiries
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{inquiry.client_name}</h1>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${stageBadgeClass(inquiry.stage)}`}>
              {stageLabel(inquiry.stage)}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500">{inquiry.inquiry_code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {perms.update ? (
            <button type="button" onClick={() => setModal('stage')} className="rounded border border-slate-300 px-3 py-2 text-sm">
              Change stage
            </button>
          ) : null}
          {perms.assign ? (
            <button type="button" onClick={() => setModal('assign')} className="rounded border border-slate-300 px-3 py-2 text-sm">
              Assign
            </button>
          ) : null}
          {perms.update ? (
            <Link href={`/inquiries/${id}/edit`} className="rounded border border-slate-300 px-3 py-2 text-sm">
              Edit
            </Link>
          ) : null}
          {perms.delete ? (
            <button type="button" onClick={remove} className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Overview */}
          <section className="rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Overview</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
              <Field label="Phone" value={inquiry.phone} />
              <Field label="Email" value={inquiry.email} />
              <Field label="WhatsApp" value={inquiry.whatsapp} />
              <Field label="Priority">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(inquiry.priority)}`}>
                  {humanize(inquiry.priority)}
                </span>
              </Field>
              <Field label="Temperature">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${temperatureBadgeClass(inquiry.temperature)}`}>
                  {humanize(inquiry.temperature)}
                </span>
              </Field>
              <Field label="Lead score" value={inquiry.lead_score != null ? String(inquiry.lead_score) : null} />
              <Field label="Budget" value={budgetLabel(inquiry.budget_min, inquiry.budget_max)} />
              <Field label="Requirement" value={inquiry.requirement_type ? humanize(inquiry.requirement_type) : null} />
              <Field label="Property type" value={inquiry.property_type ? humanize(inquiry.property_type) : null} />
              <Field label="Bedrooms" value={inquiry.bedrooms != null ? String(inquiry.bedrooms) : null} />
              <Field label="Preferred location" value={inquiry.preferred_location} />
              <Field label="Timeline" value={inquiry.purchase_timeline ? humanize(inquiry.purchase_timeline) : null} />
              <Field label="Source" value={inquiry.source_name} />
              <Field label="Assignee" value={inquiry.assigned_employee_name} />
              <Field label="Property">
                {inquiry.property ? (
                  <Link href={`/properties/${inquiry.property.id}`} className="text-teal-700 hover:underline">
                    {inquiry.property.title}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </Field>
            </dl>
            {inquiry.remarks ? (
              <div className="mt-4 rounded bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-medium uppercase text-slate-400">Remarks</p>
                {inquiry.remarks}
              </div>
            ) : null}
            {inquiry.lost_reason ? (
              <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">Lost reason: {inquiry.lost_reason}</p>
            ) : null}
          </section>

          {/* Follow-ups */}
          <section className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Follow-ups</h2>
              {perms.followups ? (
                <button type="button" onClick={() => setModal('followup')} className="text-sm text-teal-700 hover:underline">
                  + Add
                </button>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {inquiry.followups && inquiry.followups.length > 0 ? (
                inquiry.followups.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{humanize(f.followup_type)}</span>
                      <span className="ml-2 text-slate-500">
                        {f.followup_date}
                        {f.followup_time ? ` ${f.followup_time}` : ''}
                      </span>
                      {f.notes ? <p className="text-xs text-slate-400">{f.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{humanize(f.status)}</span>
                      {perms.followups && f.status === 'pending' ? (
                        <>
                          <button type="button" onClick={() => updateFollowupStatus(f.id, 'completed')} className="text-xs text-teal-700 hover:underline">
                            Complete
                          </button>
                          <button type="button" onClick={() => updateFollowupStatus(f.id, 'missed')} className="text-xs text-slate-500 hover:underline">
                            Miss
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No follow-ups scheduled.</p>
              )}
            </div>
          </section>

          {/* Site visits */}
          <section className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Site visits</h2>
              {perms.siteVisits ? (
                <button type="button" onClick={() => setModal('site-visit')} className="text-sm text-teal-700 hover:underline">
                  + Schedule
                </button>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {inquiry.site_visits && inquiry.site_visits.length > 0 ? (
                inquiry.site_visits.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{new Date(s.scheduled_at).toLocaleString()}</span>
                      {s.property ? <span className="ml-2 text-slate-500">{s.property.title}</span> : null}
                      {s.employee_name ? <p className="text-xs text-slate-400">with {s.employee_name}</p> : null}
                      {s.notes ? <p className="text-xs text-slate-400">{s.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{humanize(s.status)}</span>
                      {perms.siteVisits && s.status === 'scheduled' ? (
                        <>
                          <button type="button" onClick={() => updateSiteVisitStatus(s.id, 'completed')} className="text-xs text-teal-700 hover:underline">
                            Complete
                          </button>
                          <button type="button" onClick={() => updateSiteVisitStatus(s.id, 'no_show')} className="text-xs text-slate-500 hover:underline">
                            No show
                          </button>
                          <button type="button" onClick={() => updateSiteVisitStatus(s.id, 'cancelled')} className="text-xs text-slate-500 hover:underline">
                            Cancel
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No site visits scheduled.</p>
              )}
            </div>
          </section>

          {/* Notes */}
          <section className="rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Notes</h2>
            {perms.notes ? (
              <div className="mt-3 flex gap-2">
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note…"
                  className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <button type="button" onClick={addNote} disabled={noteSaving || !newNote.trim()} className="rounded bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-50">
                  Add
                </button>
              </div>
            ) : null}
            <div className="mt-3 space-y-2">
              {inquiry.notes && inquiry.notes.length > 0 ? (
                inquiry.notes.map((n) => (
                  <div key={n.id} className="rounded border border-slate-100 px-3 py-2 text-sm">
                    <p className="text-slate-700">{n.note}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {n.created_by_email ?? 'system'} · {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No notes yet.</p>
              )}
            </div>
          </section>
        </div>

        {/* Timeline */}
        <aside className="rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Timeline</h2>
          <div className="mt-4">
            <Timeline activities={activities} history={history} />
          </div>
        </aside>
      </div>

      {modal === 'stage' ? <StageModal inquiry={inquiry} onClose={() => setModal(null)} onDone={load} /> : null}
      {modal === 'assign' ? <AssignModal inquiry={inquiry} onClose={() => setModal(null)} onDone={load} /> : null}
      {modal === 'followup' ? <FollowupModal inquiry={inquiry} onClose={() => setModal(null)} onDone={load} /> : null}
      {modal === 'site-visit' ? <SiteVisitModal inquiry={inquiry} onClose={() => setModal(null)} onDone={load} /> : null}
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{children ?? value ?? <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}
