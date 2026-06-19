'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ActionGuard } from '../../../../components/shared/ActionGuard';
import { ConfirmDialog } from '../../../../components/ui';
import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import {
  formatINR,
  humanize,
  statusBadgeClass,
  type Property,
  type PropertyHistoryEntry,
} from '../../../../lib/properties';
import { AssignModal } from './assign-modal';
import { PropertyMapPreview } from '../../../../components/properties/property-map-preview';
import { PropertyNearbyPlaces } from '../../../../components/properties/property-nearby-places';
import { PropertyVideoManager } from '../../../../components/properties/property-video-manager';

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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

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

  async function uploadImageFiles(files: FileList | null) {
    const session = getSession();
    if (!session?.access_token || !files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} is not an image`);
        }
        const contentBase64 = await readFileAsDataUrl(file);
        await apiFetch(`/api/v1/properties/${id}/images`, {
          method: 'POST',
          token: session.access_token,
          body: JSON.stringify({
            content_base64: contentBase64,
            filename: file.name,
            content_type: file.type,
          }),
        });
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
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
    setDeleting(true);
    try {
      await apiFetch(`/api/v1/properties/${id}`, {
        method: 'DELETE',
        token: session.access_token,
      });
      router.push('/properties');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error && !property) return <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;
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
    ['Latitude', property.latitude?.toString() ?? '—'],
    ['Longitude', property.longitude?.toString() ?? '—'],
    ['Bedrooms', property.bedrooms?.toString() ?? '—'],
    ['Bathrooms', property.bathrooms?.toString() ?? '—'],
    ['Balconies', property.balconies?.toString() ?? '—'],
    ['Floor', property.floor?.toString() ?? '—'],
    ['Total floors', property.total_floors?.toString() ?? '—'],
    ['Super built-up', property.super_builtup_area ? `${property.super_builtup_area} sqft` : '—'],
    ['Carpet area', property.carpet_area ? `${property.carpet_area} sqft` : '—'],
  ];

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-xs font-medium text-slate-500" aria-label="Breadcrumb">
        <Link href="/properties" className="transition hover:text-teal-700">
          Properties
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700">{property.property_code}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">{property.title}</h1>
            <span className={`rounded-full px-2.5 py-1 text-2xs font-bold ${statusBadgeClass(property.status)}`}>
              {humanize(property.status)}
            </span>
            {property.is_public ? (
              <span className="badge badge-teal">Public</span>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500">{property.property_code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionGuard permission="properties.assign">
            <button type="button" onClick={() => setShowAssign(true)} className="btn-secondary">
              Assign
            </button>
          </ActionGuard>
          <ActionGuard permission="properties.update">
            <Link href={`/properties/${id}/edit`} className="btn-primary">
              Edit
            </Link>
          </ActionGuard>
          <ActionGuard permission="properties.delete">
            <button type="button" onClick={() => setDeleteOpen(true)} className="btn-danger">
              Delete
            </button>
          </ActionGuard>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Images */}
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-h3">Images</h2>
                <p className="mt-1 text-xs text-slate-500">Manage listing media and choose the public cover image.</p>
              </div>
              <span className="badge badge-slate">{property.images.length} images</span>
            </div>
            {property.images.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-reos-border bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No images yet. Add at least one image before publishing publicly.
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {property.images.map((img) => (
                  <div key={img.id} className="group relative overflow-hidden rounded-2xl border border-reos-border bg-slate-100">
                    <Image
                      src={img.url}
                      alt={img.alt_text ?? property.title}
                      width={320}
                      height={128}
                      unoptimized
                      className="h-32 w-full object-cover"
                    />
                    {img.is_cover ? (
                      <span className="absolute left-2 top-2 rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Cover
                      </span>
                    ) : null}
                    <ActionGuard permission="properties.update">
                      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-slate-950/70 p-2 opacity-0 transition group-hover:opacity-100">
                        {!img.is_cover ? (
                          <button type="button" onClick={() => setCover(img.id)} className="text-[11px] font-semibold text-white hover:underline">
                            Set cover
                          </button>
                        ) : <span />}
                        <button type="button" onClick={() => deleteImage(img.id)} className="text-[11px] font-semibold text-rose-200 hover:underline">
                          Delete
                        </button>
                      </div>
                    </ActionGuard>
                  </div>
                ))}
              </div>
            )}
            <ActionGuard permission="properties.update">
              <div className="mt-4 space-y-3">
                <label
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-reos-border bg-slate-50 px-4 py-6 text-center text-sm transition hover:border-teal-400 hover:bg-teal-50/40 ${
                    uploading ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      void uploadImageFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <span className="font-semibold text-slate-700">
                    {uploading ? 'Uploading…' : 'Click to upload images'}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    PNG, JPG, WEBP or GIF. You can select multiple files.
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Or paste an image URL (https://…)"
                    className="input"
                  />
                  <button
                    type="button"
                    onClick={addImage}
                    disabled={!imageUrl.trim() || uploading}
                    className="btn-secondary whitespace-nowrap disabled:opacity-50"
                  >
                    Add by URL
                  </button>
                </div>
              </div>
            </ActionGuard>
          </section>

          <PropertyVideoManager
            propertyId={property.id}
            videos={property.videos}
            title={property.title}
          />

          {property.latitude != null && property.longitude != null ? (
            <>
              <PropertyMapPreview
                latitude={property.latitude}
                longitude={property.longitude}
                title={property.title}
              />
              <PropertyNearbyPlaces
                latitude={property.latitude}
                longitude={property.longitude}
              />
            </>
          ) : null}

          {/* Details */}
          <section className="card p-5">
            <h2 className="text-h3">Details</h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {detailRows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{k}</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
            {property.description ? (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Description</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{property.description}</p>
              </div>
            ) : null}
            {property.amenities.length ? (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Amenities</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {property.amenities.map((a) => (
                    <span key={a} className="badge badge-slate">{a}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {/* Sidebar: assignments + history */}
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-h3">Assigned agents</h2>
            {property.assignments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No agents assigned.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {property.assignments.map((a) => (
                  <li key={a.employee_id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span className="font-medium text-slate-800">{a.employee_name ?? a.employee_id}</span>
                    {a.is_primary ? (
                      <span className="badge badge-teal">Primary</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-h3">History</h2>
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
      <ConfirmDialog
        open={deleteOpen}
        title="Delete this property?"
        description="This is a soft delete. The listing will be removed from active property lists but can still be retained for audit history."
        confirmLabel="Delete property"
        danger
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
