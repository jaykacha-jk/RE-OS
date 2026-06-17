'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiFetch } from '../../../../../lib/api';
import { getSession } from '../../../../../lib/auth';
import type { Inquiry } from '../../../../../lib/crm';
import { InquiryForm } from '../../inquiry-form';

export default function EditInquiryPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session?.access_token) return;
    apiFetch<Inquiry>(`/api/v1/inquiries/${id}`, { token: session.access_token })
      .then((res) => setInquiry(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load inquiry'));
  }, [id]);

  if (error) return <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;
  if (!inquiry) return <p className="text-slate-500">Loading…</p>;

  return <InquiryForm mode="edit" inquiry={inquiry} />;
}
