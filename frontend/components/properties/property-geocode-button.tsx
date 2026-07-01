'use client';

import { useState } from 'react';

import { apiFetch } from '../../lib/api';
import { getSession } from '../../lib/auth';

type GeocodeResult = {
  latitude: number;
  longitude: number;
  display_name: string;
};

type PropertyGeocodeButtonProps = {
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  onResolved: (result: GeocodeResult) => void;
};

export function PropertyGeocodeButton({
  address,
  city,
  state,
  pincode,
  country,
  onResolved,
}: PropertyGeocodeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    const session = getSession();
    if (!session?.access_token) return;
    if (!city.trim() && !address.trim()) {
      setError('Enter at least a city or street address first.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const params = new URLSearchParams();
    if (address.trim()) params.set('address', address.trim());
    if (city.trim()) params.set('city', city.trim());
    if (state.trim()) params.set('state', state.trim());
    if (pincode.trim()) params.set('pincode', pincode.trim());
    if (country.trim()) params.set('country', country.trim());

    try {
      const res = await apiFetch<GeocodeResult>(`/api/v1/properties/geocode?${params}`, {
        token: session.access_token,
      });
      onResolved(res.data);
      setMessage(res.data.display_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Geocode lookup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full basis-full space-y-2 rounded-2xl border border-reos-border bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Look up map coordinates from the address fields above.
        </p>
        <button
          type="button"
          className="btn-secondary"
          disabled={loading}
          onClick={() => void lookup()}
        >
          {loading ? 'Looking up…' : 'Look up coordinates'}
        </button>
      </div>
      {message ? <p className="text-xs text-teal-700">{message}</p> : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
