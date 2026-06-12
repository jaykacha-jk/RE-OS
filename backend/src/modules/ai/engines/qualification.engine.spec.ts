import {
  classifyTemperature,
  extractRequirements,
  parseIndianAmount,
  qualify,
  scoreLead,
} from './qualification.engine';

describe('qualification.engine', () => {
  describe('parseIndianAmount', () => {
    it('parses crore / lakh / k units', () => {
      expect(parseIndianAmount('1 crore')).toBe(10000000);
      expect(parseIndianAmount('90 lakh')).toBe(9000000);
      expect(parseIndianAmount('50L')).toBe(5000000);
      expect(parseIndianAmount('500k')).toBe(500000);
    });

    it('treats small bare numbers as lakhs', () => {
      expect(parseIndianAmount('80')).toBe(8000000);
    });
  });

  describe('extractRequirements', () => {
    it('extracts a full residential buy requirement', () => {
      const r = extractRequirements(
        'Looking to buy a 3 BHK flat in SG Highway, Ahmedabad with budget 90 lakh to 1 crore. Need a home loan and want to move in immediately.',
      );
      expect(r.requirement_type).toBe('buy');
      expect(r.property_type).toBe('residential');
      expect(r.bedrooms).toBe(3);
      expect(r.city).toBe('Ahmedabad');
      expect(r.budget_min).toBe(9000000);
      expect(r.budget_max).toBe(10000000);
      expect(r.timeline).toBe('immediate');
      expect(r.financing_need).toBe(true);
      expect(r.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('detects commercial rent intent', () => {
      const r = extractRequirements('I want to rent an office space / showroom in Pune.');
      expect(r.requirement_type).toBe('rent');
      expect(r.property_type).toBe('commercial');
      expect(r.city).toBe('Pune');
    });

    it('returns low confidence for vague text', () => {
      const r = extractRequirements('Just browsing, not sure yet.');
      expect(r.timeline).toBe('exploring');
      expect(r.confidence).toBeLessThan(0.5);
    });
  });

  describe('scoreLead + classifyTemperature', () => {
    it('scores a clear, urgent, engaged lead as hot', () => {
      const extracted = extractRequirements(
        'Buy 3 BHK in Ahmedabad, budget 90 lakh to 1 crore, need loan, move immediately.',
      );
      const { score } = scoreLead(extracted, { responses: 5, durationSeconds: 240 });
      expect(score).toBeGreaterThanOrEqual(70);
      expect(classifyTemperature(score)).toBe('hot');
    });

    it('scores a vague, low-engagement lead as cold', () => {
      const extracted = extractRequirements('Just looking around.');
      const { score } = scoreLead(extracted, { responses: 0, durationSeconds: 0 });
      expect(classifyTemperature(score)).toBe('cold');
    });

    it('classifies thresholds', () => {
      expect(classifyTemperature(70)).toBe('hot');
      expect(classifyTemperature(40)).toBe('warm');
      expect(classifyTemperature(39)).toBe('cold');
    });
  });

  describe('qualify', () => {
    it('returns extracted + score + breakdown + temperature', () => {
      const result = qualify('Buy 2 BHK flat in Pune around 60 lakh in 1-3 months', {
        responses: 3,
        durationSeconds: 120,
      });
      expect(result.extracted.bedrooms).toBe(2);
      expect(result.breakdown.budget).toBeGreaterThan(0);
      expect(['hot', 'warm', 'cold']).toContain(result.temperature);
    });
  });
});
