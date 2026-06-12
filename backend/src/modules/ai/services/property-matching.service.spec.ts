import type { MatchableProperty } from '../engines/matching.engine';
import { PropertyMatchingService } from './property-matching.service';

function makeProps(): MatchableProperty[] {
  return [
    {
      id: 'p1',
      title: '3 BHK SG Highway',
      property_code: 'P1',
      slug: 'p1',
      city: 'Ahmedabad',
      type: 'residential',
      category: 'apartment',
      requirement_type: 'buy',
      price: 9500000,
      bedrooms: 3,
      amenities: ['Gym'],
    },
    {
      id: 'p2',
      title: '2 BHK Bopal',
      property_code: 'P2',
      slug: 'p2',
      city: 'Ahmedabad',
      type: 'residential',
      category: 'apartment',
      requirement_type: 'buy',
      price: 5500000,
      bedrooms: 2,
      amenities: [],
    },
  ];
}

describe('PropertyMatchingService', () => {
  const settings = { resolve: jest.fn().mockResolvedValue({ provider: 'mock' }) };
  const usage = { record: jest.fn().mockResolvedValue(undefined) };

  function build(repoOverrides: Record<string, jest.Mock> = {}) {
    const repo = {
      findMatchableProperties: jest.fn().mockResolvedValue(makeProps()),
      findInquiryBasic: jest.fn(),
      ...repoOverrides,
    };
    const service = new PropertyMatchingService(
      repo as never,
      settings as never,
      usage as never,
    );
    return { service, repo };
  }

  beforeEach(() => jest.clearAllMocks());

  it('matches free-text criteria and ranks the best property first', async () => {
    const { service } = build();
    const res = await service.match('t1', {
      text: 'buy 3 BHK in Ahmedabad around 95 lakh',
    } as never);
    expect(res.matches[0].property_id).toBe('p1');
    expect(res.matches[0].match_score).toBeGreaterThanOrEqual(res.matches[1].match_score);
    expect(usage.record).toHaveBeenCalledTimes(1);
  });

  it('resolves criteria from an inquiry id', async () => {
    const findInquiryBasic = jest.fn().mockResolvedValue({
      budget_min: 5000000,
      budget_max: 6000000,
      preferred_location: 'Ahmedabad',
      property_type: 'residential',
      requirement_type: 'buy',
      bedrooms: 2,
    });
    const { service } = build({ findInquiryBasic });
    const res = await service.match('t1', { inquiry_id: 'i1', limit: 1 } as never);
    expect(findInquiryBasic).toHaveBeenCalledWith('t1', 'i1');
    expect(res.matches[0].property_id).toBe('p2');
  });

  it('retries without filters when a strict filter returns nothing', async () => {
    const findMatchableProperties = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(makeProps());
    const { service } = build({ findMatchableProperties });
    const res = await service.match('t1', { city: 'Nowhere', text: 'flat' } as never);
    expect(findMatchableProperties).toHaveBeenCalledTimes(2);
    expect(res.matches.length).toBeGreaterThan(0);
  });
});
