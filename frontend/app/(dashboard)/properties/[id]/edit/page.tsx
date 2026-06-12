'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiFetch } from '../../../../../lib/api';
import { getSession } from '../../../../../lib/auth';
import type { Property } from '../../../../../lib/properties';
import { PropertyForm } from '../../property-form';

export default function EditPropertyPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [property, setProperty] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session?.access_token || !id) return;
    apiFetch<Property>(`/api/v1/properties/${id}`, { token: session.access_token })
      .then((res) => setProperty(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="max-w-4xl">
      <Link href={`/properties/${id}`} className="text-sm text-teal-700 hover:underline">
        ← Back to property
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Edit property</h1>
      {loading ? <p className="mt-6 text-slate-500">Loading…</p> : null}
      {error ? <p className="mt-6 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {property ? <PropertyForm mode="edit" property={property} /> : null}
    </div>
  );
}
