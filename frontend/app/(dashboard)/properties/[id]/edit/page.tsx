'use client';

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

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;
  if (!property) return null;

  return <PropertyForm mode="edit" property={property} />;
}
