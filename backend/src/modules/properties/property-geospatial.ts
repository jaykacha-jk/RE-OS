export type NearbyPlace = {
  name: string;
  category: string;
  distance_m: number;
  latitude: number;
  longitude: number;
};

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'RE-OS/1.0 (real-estate-saas; contact@reos.app)';

const AMENITY_LABELS: Record<string, string> = {
  school: 'School',
  hospital: 'Hospital',
  pharmacy: 'Pharmacy',
  bank: 'Bank',
  restaurant: 'Restaurant',
  supermarket: 'Supermarket',
  marketplace: 'Market',
  bus_station: 'Bus stop',
  railway: 'Railway station',
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusM = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * earthRadiusM * Math.asin(Math.sqrt(a)));
}

function placeCategory(tags: Record<string, string>): string {
  if (tags.railway === 'station') return 'Railway station';
  if (tags.amenity && AMENITY_LABELS[tags.amenity]) return AMENITY_LABELS[tags.amenity]!;
  if (tags.amenity) return tags.amenity.replace(/_/g, ' ');
  if (tags.shop) return tags.shop.replace(/_/g, ' ');
  return 'Place';
}

function elementCoords(element: {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
}): { lat: number; lon: number } | null {
  if (element.lat != null && element.lon != null) {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center) {
    return { lat: element.center.lat, lon: element.center.lon };
  }
  return null;
}

export async function fetchNearbyPlaces(
  latitude: number,
  longitude: number,
  radiusM = 1500,
  fetchImpl: typeof fetch = fetch,
): Promise<NearbyPlace[]> {
  const query = `
[out:json][timeout:25];
(
  node["amenity"~"school|hospital|pharmacy|bank|restaurant|supermarket|marketplace|bus_station"](around:${radiusM},${latitude},${longitude});
  way["amenity"~"school|hospital|pharmacy|bank|restaurant|supermarket|marketplace|bus_station"](around:${radiusM},${latitude},${longitude});
  node["railway"="station"](around:${Math.min(radiusM + 500, 3000)},${latitude},${longitude});
  way["railway"="station"](around:${Math.min(radiusM + 500, 3000)},${latitude},${longitude});
);
out center 30;
`.trim();

  const response = await fetchImpl(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    elements?: Array<{
      id: number;
      tags?: Record<string, string>;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
    }>;
  };

  const seen = new Set<string>();
  const places: NearbyPlace[] = [];

  for (const element of payload.elements ?? []) {
    const tags = element.tags ?? {};
    const name = tags.name?.trim();
    if (!name) continue;

    const coords = elementCoords(element);
    if (!coords) continue;

    const dedupeKey = `${name.toLowerCase()}|${coords.lat.toFixed(4)}|${coords.lon.toFixed(4)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    places.push({
      name,
      category: placeCategory(tags),
      distance_m: haversineMeters(latitude, longitude, coords.lat, coords.lon),
      latitude: coords.lat,
      longitude: coords.lon,
    });
  }

  return places.sort((a, b) => a.distance_m - b.distance_m).slice(0, 15);
}

export async function geocodeAddress(
  parts: { address?: string; city?: string; state?: string; pincode?: string; country?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ latitude: number; longitude: number; display_name: string } | null> {
  const query = [parts.address, parts.city, parts.state, parts.pincode, parts.country ?? 'India']
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');

  if (!query) return null;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);

  const response = await fetchImpl(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Geocode request failed (${response.status})`);
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  const hit = results[0];
  if (!hit) return null;

  return {
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
    display_name: hit.display_name,
  };
}
