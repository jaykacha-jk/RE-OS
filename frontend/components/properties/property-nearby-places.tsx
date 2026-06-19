'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '../../lib/api';
import { getSession } from '../../lib/auth';

type NearbyPlace = {
  name: string;
  category: string;
  distance_m: number;
  latitude: number;
  longitude: number;
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function PropertyNearbyPlaces({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session?.access_token) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      radius_m: '1500',
    });

    apiFetch<{ places: NearbyPlace[] }>(`/api/v1/properties/nearby-places?${params}`, {
      token: session.access_token,
    })
      .then((res) => {
        if (!cancelled) setPlaces(res.data.places);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load nearby places');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  return (
    <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
      <div className="border-b border-reos-border px-5 py-4">
        <h2 className="text-h3">Nearby places</h2>
        <p className="mt-1 text-xs text-slate-500">
          Schools, hospitals, transit, and shops within ~1.5 km (OpenStreetMap)
        </p>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading nearby places…</p>
        ) : error ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </p>
        ) : places.length === 0 ? (
          <p className="text-sm text-slate-500">No named places found nearby.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {places.map((place) => (
              <li key={`${place.name}-${place.latitude}`} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{place.name}</p>
                  <p className="text-xs text-slate-500">{place.category}</p>
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-teal-700">
                  {formatDistance(place.distance_m)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
