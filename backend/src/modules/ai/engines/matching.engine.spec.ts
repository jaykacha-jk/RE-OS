import { matchProperties, scoreProperty, type MatchableProperty } from './matching.engine';

const base: MatchableProperty = {
  id: 'p1',
  title: '3 BHK in SG Highway',
  property_code: 'PROP-1',
  slug: '3-bhk-sg-highway',
  city: 'Ahmedabad',
  type: 'residential',
  category: 'apartment',
  requirement_type: 'buy',
  price: 9500000,
  bedrooms: 3,
  amenities: ['Gym', 'Swimming Pool'],
};

describe('matching.engine', () => {
  it('scores a perfect match highly with reasons', () => {
    const match = scoreProperty(base, {
      budget_min: 9000000,
      budget_max: 10000000,
      city: 'Ahmedabad',
      property_type: 'residential',
      requirement_type: 'buy',
      bedrooms: 3,
    });
    expect(match.score).toBeGreaterThanOrEqual(90);
    expect(match.reasons).toEqual(expect.arrayContaining(['Within budget', '3 BHK match']));
  });

  it('penalizes out-of-budget properties', () => {
    const inBudget = scoreProperty(base, { budget_max: 10000000 });
    const overBudget = scoreProperty(base, { budget_max: 6000000 });
    expect(overBudget.score).toBeLessThan(inBudget.score);
  });

  it('rewards location match', () => {
    const right = scoreProperty(base, { city: 'Ahmedabad' });
    const wrong = scoreProperty(base, { city: 'Mumbai' });
    expect(right.score).toBeGreaterThan(wrong.score);
  });

  it('ranks candidates and respects the limit', () => {
    const cheaper: MatchableProperty = { ...base, id: 'p2', price: 6000000, bedrooms: 2 };
    const ranked = matchProperties([cheaper, base], {
      budget_min: 9000000,
      budget_max: 10000000,
      bedrooms: 3,
      city: 'Ahmedabad',
    }, 1);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].property.id).toBe('p1');
  });

  it('never returns empty reasons', () => {
    const match = scoreProperty({ ...base, price: null }, {});
    expect(match.reasons.length).toBeGreaterThan(0);
  });
});
