import { fetchNearbyPlaces, geocodeAddress } from './property-geospatial';

describe('property-geospatial', () => {
  it('maps Overpass elements to sorted nearby places', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          {
            id: 1,
            tags: { name: 'City Hospital', amenity: 'hospital' },
            lat: 23.025,
            lon: 72.575,
          },
          {
            id: 2,
            tags: { name: 'Metro School', amenity: 'school' },
            center: { lat: 23.02, lon: 72.57 },
          },
        ],
      }),
    });

    const places = await fetchNearbyPlaces(23.0225, 72.5714, 1500, fetchImpl as never);

    expect(places).toHaveLength(2);
    expect(places[0]!.category).toBe('School');
    expect(places[0]!.distance_m).toBeGreaterThanOrEqual(0);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('returns null when geocode has no hits', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const result = await geocodeAddress({ city: 'Nowhere' }, fetchImpl as never);
    expect(result).toBeNull();
  });

  it('returns coordinates from Nominatim', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { lat: '23.0225', lon: '72.5714', display_name: 'Ahmedabad, Gujarat, India' },
      ],
    });

    const result = await geocodeAddress(
      { address: 'SG Highway', city: 'Ahmedabad', country: 'India' },
      fetchImpl as never,
    );

    expect(result).toEqual({
      latitude: 23.0225,
      longitude: 72.5714,
      display_name: 'Ahmedabad, Gujarat, India',
    });
  });
});
