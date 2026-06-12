'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession, hasPermission } from '../../../../lib/auth';
import {
  formatINR,
  humanize,
  statusBadgeClass,
  type Property,
  type PropertyHistoryEntry,
} from '../../../../lib/properties';
import { AssignModal } from './assign-modal';

function changeLabel(type: string): string {
  const map: Record<string, string> = {
    created: 'Property created',
    property_updated: 'Property updated',
    price_changed: 'Price changed',
    status_changed: 'Status changed',
    assignment_changed: 'Assignment changed',
  };
  return map[type] ?? humanize(type);
}

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [property, setProperty] = useState<Property | null>(null);
  const [history, setHistory] = useState<PropertyHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const [canUpdate, setCanUpdate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canAssign, setCanAssign] = useState(false);

  useEffect(() => {
    const s = getSession();
    setCanUpdate(hasPermission(s, 'properties.update'));
    setCanDelete(hasPermission(s, 'properties.delete'));
    setCanAssign(hasPermission(s, 'properties.assign'));
  }, []);

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token || !id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<Property>(`/api/v1/properties/${id}`, { token: session.access_token }),
      apiFetch<PropertyHistoryEntry[]>(`/api/v1/properties/${id}/history`, {
        token: session.access_token,
      }),
    ])
      .then(([p, h]) => {
        setProperty(p.data);
        setHistory(h.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addImage() {
    const session = getSession();
    if (!session?.access_token || !imageUrl.trim()) return;
    try {
      await apiFetch(`/api/v1/properties/${id}/images`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({ url: imageUrl.trim() }),
      });
      setImageUrl('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add image');
    }
  }

  async function setCover(imageId: string) {
    const session = getSession();
    if (!session?.access_token) return;
    await apiFetch(`/api/v1/properties/${id}/images/${imageId}/cover`, {
      method: 'PATCH',
      token: session.access_token,
    }).catch(() => undefined);
    load();
  }

  async function deleteImage(imageId: string) {
    const session = getSession();
    if (!session?.access_token) return;
    await apiFetch(`/api/v1/properties/${id}/images/${imageId}`, {
      method: 'DELETE',
      token: session.access_token,
    }).catch(() => undefined);
    load();
  }

  async function remove() {
    const session = getSession();
    if (!session?.access_token) return;
    if (!window.confirm('Delete this property? This is a soft delete.')) return;
    try {
      await apiFetch(`/api/v1/properties/${id}`, {
        method: 'DELETE',
        token: session.access_token,
      });
      router.push('/properties');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!property) return null;

  const detailRows: [string, string][] = [
    ['Property code', property.property_code],
    ['Slug', property.slug],
    ['Type', humanize(property.type)],
    ['Category', humanize(property.category)],
    ['Requirement', humanize(property.requirement_type)],
    ['Price', formatINR(property.price)],
    ['Maintenance', formatINR(property.maintenance)],
    ['Token amount', formatINR(property.token_amount)],
    ['City', property.city],
    ['State', property.state ?? '—'],
    ['Pincode', property.pincode ?? '—'],
    ['Bedrooms', property.bedrooms?.toString() ?? '—'],
    ['Bathrooms', property.bathrooms?.toString() ?? '—'],
    ['Balconies', property.balconies?.toString() ?? '—'],
    ['Floor', property.floor?.toString() ?? '—'],
    ['Total floors', property.total_floors?.toString() ?? '—'],
    ['Super built-up', property.super_builtup_area ? `${property.super_builtup_area} sqft` : '—'],
    ['Carpet area', property.carpet_area ? `${property.carpet_area} sqft` : '—'],
  ];

  return (
    <div>
      <Link href="/properties" className="text-sm text-teal-700 hover:underline">
        ← Back to properties
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{property.title}</h1>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(property.status)}`}>
              {humanize(property.status)}
            </span>
            {property.is_public ? (
              <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-medium text-teal-800">Public</span>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500">{property.property_code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAssign ? (
            <button onClick={() => setShowAssign(true)} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
              Assign
            </button>
          ) : null}
          {canUpdate ? (
            <Link href={`/properties/${id}/edit`} className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white">
              Edit
            </Link>
          ) : null}
          {canDelete ? (
            <button onClick={remove} className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Images */}
          <section className="rounded-lg border border-slate-200 p-4">
            <h2 className="font-medium">Images</h2>
            {property.images.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No images yet.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {property.images.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <div key={img.id} className="group relative overflow-hidden rounded border border-slate-200">
                    <img src={img.url} alt={img.alt_text ?? property.title} className="h-32 w-full object-cover" />
                    {img.is_cover ? (
                      <span className="absolute left-1 top-1 rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Cover
                      </span>
                    ) : null}
                    {canUpdate ? (
                      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1 opacity-0 transition group-hover:opacity-100">
                        {!img.is_cover ? (
                          <button onClick={() => setCover(img.id)} className="text-[11px] text-white hover:underline">
                            Set cover
                          </button>
                        ) : <span />}
                        <button onClick={() => deleteImage(img.id)} className="text-[11px] text-red-200 hover:underline">
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            {canUpdate ? (
              <div className="mt-3 flex gap-2">
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://image-url.jpg"
                  className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <button onClick={addImage} className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white">
                  Add image
                </button>
              </div>
            ) : null}
          </section>

          {/* Details */}
          <section className="rounded-lg border border-slate-200 p-4">
            <h2 className="font-medium">Details</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {detailRows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
            {property.description ? (
              <div className="mt-4">
                <dt className="text-sm text-slate-500">Description</dt>
                <p className="mt-1 text-sm text-slate-700">{property.description}</p>
              </div>
            ) : null}
            {property.amenities.length ? (
              <div className="mt-4">
                <dt className="text-sm text-slate-500">Amenities</dt>
                <div className="mt-1 flex flex-wrap gap-1">
                  {property.amenities.map((a) => (
                    <span key={a} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{a}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {/* Sidebar: assignments + history */}
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 p-4">
            <h2 className="font-medium">Assigned agents</h2>
            {property.assignments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No agents assigned.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {property.assignments.map((a) => (
                  <li key={a.employee_id} className="flex items-center justify-between">
                    <span>{a.employee_name ?? a.employee_id}</span>
                    {a.is_primary ? (
                      <span className="rounded bg-teal-100 px-2 py-0.5 text-xs text-teal-800">Primary</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 p-4">
            <h2 className="font-medium">History</h2>
            <ol className="mt-3 space-y-4">
              {history.length === 0 ? (
                <li className="text-sm text-slate-500">No history.</li>
              ) : (
                history.map((h) => (
                  <li key={h.id} className="relative border-l-2 border-slate-200 pl-4">
                    <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-teal-600" />
                    <p className="text-sm font-medium text-slate-800">{changeLabel(h.change_type)}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(h.created_at).toLocaleString()}
                      {h.changed_by_email ? ` · ${h.changed_by_email}` : ''}
                    </p>
                  </li>
                ))
              )}
            </ol>
          </section>
        </div>
      </div>

      {showAssign ? (
        <AssignModal property={property} onClose={() => setShowAssign(false)} onAssigned={load} />
      ) : null}
    </div>
  );
}
