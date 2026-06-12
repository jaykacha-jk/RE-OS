/** Cosine similarity between two equal-length numeric vectors (0..1-ish). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface ScoredDocument<T> {
  document: T;
  score: number;
}

/**
 * Rank embedded documents against a query embedding by cosine similarity.
 * Only documents whose embedding dimension matches the query are comparable
 * (guards against mixing embedding models/providers).
 */
export function rankByEmbedding<T extends { embedding: number[] }>(
  query: number[],
  documents: T[],
  limit = 5,
  minScore = 0.05,
): ScoredDocument<T>[] {
  return documents
    .map((document) => ({ document, score: cosineSimilarity(query, document.embedding) }))
    .filter((d) => d.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
