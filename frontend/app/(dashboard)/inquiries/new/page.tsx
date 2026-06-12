'use client';

import Link from 'next/link';

import { InquiryForm } from '../inquiry-form';

export default function NewInquiryPage() {
  return (
    <div className="max-w-4xl">
      <Link href="/inquiries" className="text-sm text-teal-700 hover:underline">
        ← Back to inquiries
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">New inquiry</h1>
      <p className="mt-1 text-sm text-slate-600">
        A unique inquiry code is generated automatically. New leads start in the NEW stage.
      </p>
      <InquiryForm mode="create" />
    </div>
  );
}
