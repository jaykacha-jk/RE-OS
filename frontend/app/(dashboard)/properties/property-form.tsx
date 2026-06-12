'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { apiFetch } from '../../../lib/api';
import { getSession } from '../../../lib/auth';
import {
  humanize,
  PROPERTY_CATEGORIES,
  PROPERTY_REQUIREMENT_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type Property,
} from '../../../lib/properties';

type Mode = 'create' | 'edit';

function num(value: FormDataEntryValue | null): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function str(value: FormDataEntryValue | null): string | undefined {
  const s = (value as string)?.trim();
  return s ? s : undefined;
}

export function PropertyForm({ mode, property }: { mode: Mode; property?: Property }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const session = getSession();
    if (!session?.access_token) return;
    const form = new FormData(e.currentTarget);

    const payload: Record<string, unknown> = {
      title: str(form.get('title')),
      description: str(form.get('description')),
      type: form.get('type'),
      category: form.get('category'),
      requirement_type: form.get('requirement_type'),
      status: form.get('status'),
      price: num(form.get('price')),
      maintenance: num(form.get('maintenance')),
      token_amount: num(form.get('token_amount')),
      address: str(form.get('address')),
      city: str(form.get('city')),
      state: str(form.get('state')),
      country: str(form.get('country')),
      pincode: str(form.get('pincode')),
      bedrooms: num(form.get('bedrooms')),
      bathrooms: num(form.get('bathrooms')),
      balconies: num(form.get('balconies')),
      floor: num(form.get('floor')),
      total_floors: num(form.get('total_floors')),
      super_builtup_area: num(form.get('super_builtup_area')),
      carpet_area: num(form.get('carpet_area')),
      meta_title: str(form.get('meta_title')),
      meta_description: str(form.get('meta_description')),
      is_public: form.get('is_public') === 'on',
    };

    const amenities = str(form.get('amenities'));
    if (amenities) payload.amenities = amenities.split(',').map((s) => s.trim()).filter(Boolean);
    const tags = str(form.get('tags'));
    if (tags) payload.tags = tags.split(',').map((s) => s.trim()).filter(Boolean);

    // Strip undefined so PATCH only sends provided fields.
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    setLoading(true);
    setError(null);
    try {
      if (mode === 'create') {
        const res = await apiFetch<Property>('/api/v1/properties', {
          method: 'POST',
          token: session.access_token,
          body: JSON.stringify(payload),
        });
        router.push(`/properties/${res.data.id}`);
      } else if (property) {
        await apiFetch<Property>(`/api/v1/properties/${property.id}`, {
          method: 'PATCH',
          token: session.access_token,
          body: JSON.stringify(payload),
        });
        router.push(`/properties/${property.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  const field = 'rounded border border-slate-300 px-3 py-2 text-sm';
  const label = 'block text-sm font-medium text-slate-700';

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-8">
      {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section>
        <h2 className="text-lg font-medium">Basics</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={label}>Title*</label>
            <input name="title" required defaultValue={property?.title} className={`${field} mt-1 w-full`} />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Description</label>
            <textarea name="description" rows={4} defaultValue={property?.description ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>Type*</label>
            <select name="type" required defaultValue={property?.type ?? 'residential'} className={`${field} mt-1 w-full`}>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Category*</label>
            <select name="category" required defaultValue={property?.category ?? 'flat'} className={`${field} mt-1 w-full`}>
              {PROPERTY_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Requirement*</label>
            <select name="requirement_type" required defaultValue={property?.requirement_type ?? 'sell'} className={`${field} mt-1 w-full`}>
              {PROPERTY_REQUIREMENT_TYPES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Status</label>
            <select name="status" defaultValue={property?.status ?? 'draft'} className={`${field} mt-1 w-full`}>
              {PROPERTY_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium">Pricing (INR)</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div>
            <label className={label}>Price</label>
            <input name="price" type="number" min="0" defaultValue={property?.price ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>Maintenance</label>
            <input name="maintenance" type="number" min="0" defaultValue={property?.maintenance ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>Token amount</label>
            <input name="token_amount" type="number" min="0" defaultValue={property?.token_amount ?? ''} className={`${field} mt-1 w-full`} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium">Location</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={label}>Address</label>
            <input name="address" defaultValue={property?.address ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>City*</label>
            <input name="city" required defaultValue={property?.city} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>State</label>
            <input name="state" defaultValue={property?.state ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>Country</label>
            <input name="country" defaultValue={property?.country ?? 'India'} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>Pincode</label>
            <input name="pincode" defaultValue={property?.pincode ?? ''} className={`${field} mt-1 w-full`} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium">Details</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-4">
          <div>
            <label className={label}>Bedrooms</label>
            <input name="bedrooms" type="number" min="0" defaultValue={property?.bedrooms ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>Bathrooms</label>
            <input name="bathrooms" type="number" min="0" defaultValue={property?.bathrooms ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>Balconies</label>
            <input name="balconies" type="number" min="0" defaultValue={property?.balconies ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>Floor</label>
            <input name="floor" type="number" defaultValue={property?.floor ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>Total floors</label>
            <input name="total_floors" type="number" min="0" defaultValue={property?.total_floors ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>Super built-up (sqft)</label>
            <input name="super_builtup_area" type="number" min="0" defaultValue={property?.super_builtup_area ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>Carpet area (sqft)</label>
            <input name="carpet_area" type="number" min="0" defaultValue={property?.carpet_area ?? ''} className={`${field} mt-1 w-full`} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium">Amenities, tags & SEO</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className={label}>Amenities (comma separated)</label>
            <input name="amenities" defaultValue={property?.amenities.join(', ') ?? ''} className={`${field} mt-1 w-full`} placeholder="gym, parking, lift" />
          </div>
          <div>
            <label className={label}>Tags (comma separated)</label>
            <input name="tags" defaultValue={property?.tags.join(', ') ?? ''} className={`${field} mt-1 w-full`} placeholder="premium, sea-facing" />
          </div>
          <div>
            <label className={label}>Meta title</label>
            <input name="meta_title" defaultValue={property?.meta_title ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className={label}>Meta description</label>
            <input name="meta_description" defaultValue={property?.meta_description ?? ''} className={`${field} mt-1 w-full`} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input name="is_public" type="checkbox" defaultChecked={property?.is_public ?? false} />
            Publicly listable (requires Published status + ≥1 image to appear publicly)
          </label>
        </div>
      </section>

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="rounded bg-teal-700 px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
          {loading ? 'Saving…' : mode === 'create' ? 'Create property' : 'Save changes'}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded border border-slate-300 px-5 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
