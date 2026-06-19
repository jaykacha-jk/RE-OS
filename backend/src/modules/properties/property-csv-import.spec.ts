import { mapCsvRecordToCreateDto, parseCsv, parsePropertyCsv } from './property-csv-import';

describe('property-csv-import', () => {
  it('parses quoted CSV fields', () => {
    const rows = parseCsv('title,city\n"Flat, SG Highway",Ahmedabad\n');
    expect(rows).toEqual([
      ['title', 'city'],
      ['Flat, SG Highway', 'Ahmedabad'],
    ]);
  });

  it('rejects CSV without required headers', () => {
    const parsed = parsePropertyCsv('title,city\nFlat,Ahmedabad\n');
    expect(parsed.errors[0]).toMatch(/Missing required columns/);
  });

  it('maps a valid row to CreatePropertyDto', async () => {
    const { dto, errors } = await mapCsvRecordToCreateDto({
      title: '3BHK Flat',
      type: 'residential',
      category: 'flat',
      requirement_type: 'sell',
      city: 'Ahmedabad',
      price: '8500000',
      bedrooms: '3',
      amenities: 'gym|parking',
    });
    expect(errors).toEqual([]);
    expect(dto?.title).toBe('3BHK Flat');
    expect(dto?.amenities).toEqual(['gym', 'parking']);
  });
});
