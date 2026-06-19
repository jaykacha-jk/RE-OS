'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FormField, FormPage, FormSection, TagInput } from '../../../components/ui';
import { PropertyGeocodeButton } from '../../../components/properties/property-geocode-button';
import { PropertyImageManager } from '../../../components/properties/property-image-manager';
import { PropertyVideoManager } from '../../../components/properties/property-video-manager';
import { QuotaNotice, proactiveQuotaNoticeProps, quotaApiNoticeProps } from '../../../components/billing/quota-notice';
import { useBillingUsage } from '../../../hooks/use-billing-usage';
import { useUnsavedChangesGuard } from '../../../hooks/use-unsaved-changes-guard';
import { apiFetch } from '../../../lib/api';
import { getSession } from '../../../lib/auth';
import { parseQuotaApiError, proactiveQuotaMessage, type QuotaErrorDetails } from '../../../lib/quota';
import {
  humanize,
  PROPERTY_CATEGORIES,
  PROPERTY_REQUIREMENT_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  statusBadgeClass,
  type Property,
} from '../../../lib/properties';

type Mode = 'create' | 'edit';

const AMENITY_SUGGESTIONS = ['Parking', 'Lift', 'Gym', 'Swimming pool', 'Power backup', 'Security', 'Garden', 'Clubhouse'];

function numOrUndef(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function strOrUndef(value: string): string | undefined {
  const s = value.trim();
  return s ? s : undefined;
}

export function PropertyForm({ mode, property }: { mode: Mode; property?: Property }) {
  const router = useRouter();
  const { usage, propertyAtLimit } = useBillingUsage();
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<QuotaErrorDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [title, setTitle] = useState(property?.title ?? '');
  const [description, setDescription] = useState(property?.description ?? '');
  const [type, setType] = useState(property?.type ?? 'residential');
  const [category, setCategory] = useState(property?.category ?? 'flat');
  const [requirementType, setRequirementType] = useState(property?.requirement_type ?? 'sell');
  const [status, setStatus] = useState(property?.status ?? 'draft');

  const [price, setPrice] = useState(property?.price != null ? String(property.price) : '');
  const [maintenance, setMaintenance] = useState(property?.maintenance != null ? String(property.maintenance) : '');
  const [tokenAmount, setTokenAmount] = useState(property?.token_amount != null ? String(property.token_amount) : '');

  const [address, setAddress] = useState(property?.address ?? '');
  const [city, setCity] = useState(property?.city ?? '');
  const [stateVal, setStateVal] = useState(property?.state ?? '');
  const [country, setCountry] = useState(property?.country ?? 'India');
  const [pincode, setPincode] = useState(property?.pincode ?? '');
  const [latitude, setLatitude] = useState(property?.latitude != null ? String(property.latitude) : '');
  const [longitude, setLongitude] = useState(property?.longitude != null ? String(property.longitude) : '');

  const [bedrooms, setBedrooms] = useState(property?.bedrooms != null ? String(property.bedrooms) : '');
  const [bathrooms, setBathrooms] = useState(property?.bathrooms != null ? String(property.bathrooms) : '');
  const [balconies, setBalconies] = useState(property?.balconies != null ? String(property.balconies) : '');
  const [floor, setFloor] = useState(property?.floor != null ? String(property.floor) : '');
  const [totalFloors, setTotalFloors] = useState(property?.total_floors != null ? String(property.total_floors) : '');
  const [superArea, setSuperArea] = useState(property?.super_builtup_area != null ? String(property.super_builtup_area) : '');
  const [carpetArea, setCarpetArea] = useState(property?.carpet_area != null ? String(property.carpet_area) : '');

  const [amenities, setAmenities] = useState<string[]>(property?.amenities ?? []);
  const [tags, setTags] = useState<string[]>(property?.tags ?? []);
  const [metaTitle, setMetaTitle] = useState(property?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(property?.meta_description ?? '');
  const [isPublic, setIsPublic] = useState(property?.is_public ?? false);

  useUnsavedChangesGuard(dirty && !loading);

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  function buildPayload(statusOverride?: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      title: strOrUndef(title),
      description: strOrUndef(description),
      type,
      category,
      requirement_type: requirementType,
      status: statusOverride ?? status,
      price: numOrUndef(price),
      maintenance: numOrUndef(maintenance),
      token_amount: numOrUndef(tokenAmount),
      address: strOrUndef(address),
      city: strOrUndef(city),
      state: strOrUndef(stateVal),
      country: strOrUndef(country),
      pincode: strOrUndef(pincode),
      latitude: numOrUndef(latitude),
      longitude: numOrUndef(longitude),
      bedrooms: numOrUndef(bedrooms),
      bathrooms: numOrUndef(bathrooms),
      balconies: numOrUndef(balconies),
      floor: numOrUndef(floor),
      total_floors: numOrUndef(totalFloors),
      super_builtup_area: numOrUndef(superArea),
      carpet_area: numOrUndef(carpetArea),
      meta_title: strOrUndef(metaTitle),
      meta_description: strOrUndef(metaDescription),
      is_public: isPublic,
      amenities,
      tags,
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    return payload;
  }

  async function persist(payload: Record<string, unknown>) {
    const session = getSession();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    setQuotaError(null);
    try {
      if (mode === 'create') {
        const res = await apiFetch<Property>('/api/v1/properties', {
          method: 'POST',
          token: session.access_token,
          body: JSON.stringify(payload),
        });
        setDirty(false);
        router.push(`/properties/${res.data.id}`);
      } else if (property) {
        await apiFetch<Property>(`/api/v1/properties/${property.id}`, {
          method: 'PATCH',
          token: session.access_token,
          body: JSON.stringify(payload),
        });
        setDirty(false);
        router.push(`/properties/${property.id}`);
      }
    } catch (err) {
      const parsed = parseQuotaApiError(err);
      if (parsed) {
        setQuotaError(parsed);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Save failed');
      }
    } finally {
      setLoading(false);
    }
  }

  function saveDraft() {
    setStatus('draft');
    persist(buildPayload('draft'));
  }

  return (
    <FormPage
      eyebrow={mode === 'create' ? 'New listing' : 'Edit listing'}
      title={mode === 'create' ? 'New property' : property?.title ?? 'Edit property'}
      description="A unique property code and SEO slug are generated automatically."
      breadcrumbs={[
        { label: 'Properties', href: '/properties' },
        { label: mode === 'create' ? 'New property' : 'Edit' },
      ]}
      statusBadge={
        <span className={`rounded-full px-2.5 py-1 text-2xs font-bold ${statusBadgeClass(status)}`}>
          {humanize(status)}
        </span>
      }
      error={quotaError ? null : error}
      submitting={loading}
      submitDisabled={mode === 'create' && propertyAtLimit}
      submitLabel={mode === 'create' ? 'Create property' : 'Save changes'}
      onSubmit={() => persist(buildPayload())}
      onCancel={() => router.back()}
      saveDraftLabel="Save as draft"
      onSaveDraft={mode === 'create' && !propertyAtLimit ? saveDraft : undefined}
    >
      {mode === 'create' && usage && propertyAtLimit ? (
        <QuotaNotice
          {...proactiveQuotaNoticeProps(
            'properties',
            usage.plan.name,
            `${proactiveQuotaMessage('properties', usage)} Upgrade to add more listings.`,
          )}
        />
      ) : null}
      {quotaError ? <QuotaNotice {...quotaApiNoticeProps(quotaError)} /> : null}

      <FormSection title="Basic information" description="The essentials buyers and your team see first.">
        <FormField label="Title" required full>
          <input value={title} onChange={(e) => mark(setTitle)(e.target.value)} required className="input" placeholder="e.g. 3 BHK sea-facing apartment in Bandra" />
        </FormField>
        <FormField label="Description" full hint="A short, compelling summary of the property.">
          <textarea value={description} onChange={(e) => mark(setDescription)(e.target.value)} rows={4} className="input" placeholder="Highlight location, layout, and standout features…" />
        </FormField>
        <FormField label="Type" required>
          <select value={type} onChange={(e) => mark(setType)(e.target.value)} required className="input">
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </select>
        </FormField>
        <FormField label="Category" required>
          <select value={category} onChange={(e) => mark(setCategory)(e.target.value)} required className="input">
            {PROPERTY_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
          </select>
        </FormField>
        <FormField label="Requirement" required hint="Is this listing to sell, rent out, or a buy requirement?">
          <select value={requirementType} onChange={(e) => mark(setRequirementType)(e.target.value)} required className="input">
            {PROPERTY_REQUIREMENT_TYPES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
          </select>
        </FormField>
        <FormField label="Status">
          <select value={status} onChange={(e) => mark(setStatus)(e.target.value)} className="input">
            {PROPERTY_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </FormField>
      </FormSection>

      <FormSection title="Location" description="Where the property is. State and pincode improve search and SEO.">
        <FormField label="Address" full>
          <input value={address} onChange={(e) => mark(setAddress)(e.target.value)} className="input" placeholder="Street, building, landmark" />
        </FormField>
        <FormField label="City" required>
          <input value={city} onChange={(e) => mark(setCity)(e.target.value)} required className="input" placeholder="Mumbai" />
        </FormField>
        <FormField label="State">
          <input value={stateVal} onChange={(e) => mark(setStateVal)(e.target.value)} className="input" placeholder="Maharashtra" />
        </FormField>
        <FormField label="Country">
          <input value={country} onChange={(e) => mark(setCountry)(e.target.value)} className="input" />
        </FormField>
        <FormField label="Pincode">
          <input value={pincode} onChange={(e) => mark(setPincode)(e.target.value)} className="input" placeholder="400050" inputMode="numeric" />
        </FormField>
        <FormField label="Latitude" hint="Decimal degrees (e.g. 19.0760). Used for map placement.">
          <input value={latitude} onChange={(e) => mark(setLatitude)(e.target.value)} type="number" step="any" className="input" placeholder="19.0760" />
        </FormField>
        <FormField label="Longitude" hint="Decimal degrees (e.g. 72.8777). Used for map placement.">
          <input value={longitude} onChange={(e) => mark(setLongitude)(e.target.value)} type="number" step="any" className="input" placeholder="72.8777" />
        </FormField>
        <PropertyGeocodeButton
          address={address}
          city={city}
          state={stateVal}
          pincode={pincode}
          country={country}
          onResolved={(result) => {
            mark(setLatitude)(String(result.latitude));
            mark(setLongitude)(String(result.longitude));
          }}
        />
      </FormSection>

      <FormSection title="Pricing" description="All amounts in INR (₹).">
        <FormField label="Price" hint="Total asking price or rent.">
          <input value={price} onChange={(e) => mark(setPrice)(e.target.value)} type="number" min="0" className="input" placeholder="7500000" />
        </FormField>
        <FormField label="Maintenance" hint="Monthly maintenance, if any.">
          <input value={maintenance} onChange={(e) => mark(setMaintenance)(e.target.value)} type="number" min="0" className="input" placeholder="3500" />
        </FormField>
        <FormField label="Token amount" hint="Booking / token to block the deal.">
          <input value={tokenAmount} onChange={(e) => mark(setTokenAmount)(e.target.value)} type="number" min="0" className="input" placeholder="100000" />
        </FormField>
      </FormSection>

      <FormSection
        title="Configuration & area"
        description="Layout and measurements. Optional — fill what you know."
        collapsible
        defaultOpen={mode === 'edit'}
      >
        <FormField label="Bedrooms">
          <input value={bedrooms} onChange={(e) => mark(setBedrooms)(e.target.value)} type="number" min="0" className="input" placeholder="3" />
        </FormField>
        <FormField label="Bathrooms">
          <input value={bathrooms} onChange={(e) => mark(setBathrooms)(e.target.value)} type="number" min="0" className="input" placeholder="2" />
        </FormField>
        <FormField label="Balconies">
          <input value={balconies} onChange={(e) => mark(setBalconies)(e.target.value)} type="number" min="0" className="input" placeholder="1" />
        </FormField>
        <FormField label="Floor">
          <input value={floor} onChange={(e) => mark(setFloor)(e.target.value)} type="number" className="input" placeholder="5" />
        </FormField>
        <FormField label="Total floors">
          <input value={totalFloors} onChange={(e) => mark(setTotalFloors)(e.target.value)} type="number" min="0" className="input" placeholder="12" />
        </FormField>
        <FormField label="Super built-up (sqft)">
          <input value={superArea} onChange={(e) => mark(setSuperArea)(e.target.value)} type="number" min="0" className="input" placeholder="1450" />
        </FormField>
        <FormField label="Carpet area (sqft)">
          <input value={carpetArea} onChange={(e) => mark(setCarpetArea)(e.target.value)} type="number" min="0" className="input" placeholder="1100" />
        </FormField>
      </FormSection>

      <FormSection title="Amenities & tags" description="Press Enter or comma to add. Tags power internal search and filtering." collapsible defaultOpen={mode === 'edit'}>
        <FormField label="Amenities" full>
          <TagInput value={amenities} onChange={mark(setAmenities)} placeholder="Add an amenity…" suggestions={AMENITY_SUGGESTIONS} />
        </FormField>
        <FormField label="Tags" full hint="Internal labels e.g. premium, sea-facing, urgent.">
          <TagInput value={tags} onChange={mark(setTags)} placeholder="Add a tag…" />
        </FormField>
      </FormSection>

      <FormSection
        title="Publishing & SEO"
        description="Control public visibility and how this listing appears in search engines."
        collapsible
        defaultOpen={false}
      >
        <FormField label="Meta title" full hint="Defaults to the property title if left blank.">
          <input value={metaTitle} onChange={(e) => mark(setMetaTitle)(e.target.value)} className="input" placeholder="3 BHK Sea-Facing Apartment in Bandra | Your Agency" />
        </FormField>
        <FormField label="Meta description" full hint="Recommended 150–160 characters for search snippets.">
          <textarea value={metaDescription} onChange={(e) => mark(setMetaDescription)(e.target.value)} rows={2} className="input" placeholder="Spacious 3 BHK with sea view, modular kitchen, and 2 covered parking spots in prime Bandra West." />
        </FormField>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 rounded-xl border border-reos-border bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => mark(setIsPublic)(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Publicly listable</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Appears on your public website once the status is Published and at least one image is added.
              </span>
            </span>
          </label>
        </div>
      </FormSection>

      {mode === 'edit' && property ? (
        <>
          <PropertyImageManager propertyId={property.id} images={property.images ?? []} title={property.title} />
          <PropertyVideoManager propertyId={property.id} videos={property.videos ?? []} title={property.title} />
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-reos-border bg-slate-50 p-5 text-sm text-slate-600">
          <h2 className="font-semibold text-slate-900">Images</h2>
          <p className="mt-2">Save the property first, then upload photos on the next screen before publishing publicly.</p>
        </section>
      )}
    </FormPage>
  );
}
