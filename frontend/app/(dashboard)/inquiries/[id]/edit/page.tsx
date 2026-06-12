'use client';

import Link from 'next/link';
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

  return (
    <div className="max-w-4xl">
      <Link href={`/inquiries/${id}`} className="text-sm text-teal-700 hover:underline">
        ← Back to inquiry
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Edit inquiry</h1>
      {error ? <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {inquiry ? (
        <InquiryForm mode="edit" inquiry={inquiry} />
      ) : !error ? (
        <p className="mt-6 text-slate-500">Loading…</p>
      ) : null}
    </div>
  );
}
