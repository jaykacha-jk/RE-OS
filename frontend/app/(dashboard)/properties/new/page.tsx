'use client';

import Link from 'next/link';

import { PropertyForm } from '../property-form';

export default function NewPropertyPage() {
  return (
    <div className="max-w-4xl">
      <Link href="/properties" className="text-sm text-teal-700 hover:underline">
        ← Back to properties
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">New property</h1>
      <p className="mt-1 text-sm text-slate-600">
        A unique property code and SEO slug are generated automatically.
      </p>
      <PropertyForm mode="create" />
    </div>
  );
}
