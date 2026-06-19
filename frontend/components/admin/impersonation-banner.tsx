'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { endPlatformImpersonation } from '../../lib/platform-impersonation';
import type { ImpersonationState } from '../../lib/auth';

type Props = {
  impersonation: ImpersonationState;
  onEnded?: () => void;
};

export function ImpersonationBanner({ impersonation, onEnded }: Props) {
  const router = useRouter();
  const [ending, setEnding] = useState(false);

  const exit = async () => {
    setEnding(true);
    try {
      await endPlatformImpersonation();
      onEnded?.();
      router.push('/platform/organizations');
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold">Support mode:</span> viewing{' '}
          <span className="font-medium">{impersonation.org_name}</span>
          <span className="text-amber-800"> ({impersonation.org_slug})</span>
        </p>
        <button
          type="button"
          className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
          onClick={() => void exit()}
          disabled={ending}
        >
          {ending ? 'Exiting…' : 'Exit workspace'}
        </button>
      </div>
    </div>
  );
}
