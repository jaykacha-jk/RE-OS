import { cosineSimilarity, rankByEmbedding } from './vector.util';

describe('vector.util', () => {
  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    });

    it('returns 0 for orthogonal vectors', () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    });

    it('returns 0 for mismatched lengths or empty', () => {
      expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
      expect(cosineSimilarity([], [])).toBe(0);
    });
  });

  describe('rankByEmbedding', () => {
    const docs = [
      { id: 'a', embedding: [1, 0, 0] },
      { id: 'b', embedding: [0.9, 0.1, 0] },
      { id: 'c', embedding: [0, 1, 0] },
    ];

    it('ranks by similarity to the query', () => {
      const ranked = rankByEmbedding([1, 0, 0], docs, 2);
      expect(ranked[0].document.id).toBe('a');
      expect(ranked[1].document.id).toBe('b');
    });

    it('filters out below-threshold documents', () => {
      const ranked = rankByEmbedding([0, 0, 1], docs, 5);
      expect(ranked).toHaveLength(0);
    });
  });
});
