import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';

import type {
  EmbeddingProvider,
  EmbeddingResult,
  LLMProvider,
  LlmCompletionRequest,
  LlmCompletionResult,
  PlaceCallRequest,
  PlaceCallResult,
  TranscriptionProvider,
  TranscriptionRequest,
  TranscriptionResult,
  VoiceProvider,
} from './ai-provider.types';

/** Rough token estimate (≈ 4 chars / token) used for deterministic usage. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Deterministic, dependency-free AI provider used in development, tests, and
 * any environment without external API keys. It implements every AI capability
 * with rule-based / hashing heuristics so the whole platform runs end-to-end
 * offline. The "intelligence" (scoring, extraction) lives in the services;
 * this provider only supplies text, embeddings, transcripts, and call stubs.
 */
@Injectable()
export class MockAiProvider
  implements LLMProvider, EmbeddingProvider, TranscriptionProvider, VoiceProvider
{
  readonly name = 'mock';
  readonly model = 'mock-embed-128';
  readonly dimensions = 128;

  // --- LLMProvider -----------------------------------------------------------

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
    const prompt = request.messages.map((m) => m.content).join('\n');
    const content = request.json
      ? JSON.stringify(this.heuristicJson(lastUser?.content ?? ''))
      : this.heuristicReply(lastUser?.content ?? '', prompt);

    const promptTokens = estimateTokens(prompt);
    const completionTokens = estimateTokens(content);
    return {
      content,
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
      model: request.model ?? 'mock-llm',
      provider: this.name,
    };
  }

  private heuristicReply(userText: string, fullPrompt: string): string {
    const text = userText.toLowerCase();
    // If the prompt carried retrieved knowledge context, surface its first line.
    const ctxMatch = fullPrompt.match(/KNOWLEDGE CONTEXT:\n([\s\S]*?)(\n\n|$)/i);
    const knowledge = ctxMatch?.[1]?.split('\n').filter(Boolean)[0];
    if (/price|budget|cost|rate/.test(text)) {
      return knowledge
        ? `Based on our listings: ${knowledge}. Could you share your budget range so I can shortlist the best options for you?`
        : 'Pricing depends on the configuration and locality. What budget range are you considering?';
    }
    if (/visit|appointment|schedule|see the/.test(text)) {
      return 'I can arrange a site visit for you. What day and time works best, and which area are you interested in?';
    }
    if (/available|availability|in stock|ready/.test(text)) {
      return knowledge
        ? `Yes — ${knowledge}. Would you like me to share more details or book a visit?`
        : 'We have several options matching common requirements. Could you tell me your preferred location and BHK?';
    }
    if (/talk to|human|agent|call me|speak to/.test(text)) {
      return 'Absolutely — I will connect you with one of our property advisors right away.';
    }
    return 'Thanks for reaching out! To help you find the right property, could you share your preferred location, budget, and the type of property you are looking for?';
  }

  /**
   * Deterministic JSON extraction stub. The services run their own rule-based
   * extractor as the source of truth; this exists so an LLM-mode pipeline can be
   * exercised end-to-end with the Mock provider.
   */
  private heuristicJson(text: string): Record<string, unknown> {
    return { summary: text.slice(0, 280), confidence: 0.6, source: 'mock' };
  }

  // --- EmbeddingProvider -----------------------------------------------------

  async embed(text: string): Promise<EmbeddingResult> {
    return {
      embedding: hashingEmbedding(text, this.dimensions),
      model: this.model,
      provider: this.name,
      tokens: estimateTokens(text),
    };
  }

  // --- TranscriptionProvider -------------------------------------------------

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    const seed = request.seed ?? request.recordingUrl;
    const rng = seededRng(seed);
    const scripts: Array<{ speaker: 'agent' | 'client'; content: string }> = [
      { speaker: 'agent', content: 'Hello, this call is recorded for quality. How can I help you with your property search today?' },
      { speaker: 'client', content: 'Hi, I am looking for a 3 BHK flat in SG Highway within 90 lakhs to 1 crore.' },
      { speaker: 'agent', content: 'Great. Are you planning to buy soon, and would you need a home loan?' },
      { speaker: 'client', content: 'Yes, I want to buy in the next 3 months and I will need a loan for part of it.' },
      { speaker: 'agent', content: 'Perfect, I have a few ready-to-move options. Can I schedule a site visit this weekend?' },
      { speaker: 'client', content: 'Sure, Saturday afternoon works for me.' },
    ];
    let offset = 0;
    const segments = scripts.map((s) => {
      const seg = {
        speaker: s.speaker,
        content: s.content,
        offsetMs: offset,
        sentiment: s.speaker === 'client' ? (rng() > 0.3 ? 'positive' : 'neutral') : 'neutral',
      };
      offset += 5000 + Math.floor(rng() * 8000);
      return seg;
    });
    return {
      transcript: segments.map((s) => `${s.speaker}: ${s.content}`).join('\n'),
      segments,
      provider: this.name,
      durationSeconds: Math.round(offset / 1000),
      language: request.language ?? 'en',
    };
  }

  // --- VoiceProvider ---------------------------------------------------------

  async placeCall(request: PlaceCallRequest): Promise<PlaceCallResult> {
    return {
      provider: this.name,
      callSid: `mock_call_${randomBytes(8).toString('hex')}`,
      status: 'in_progress',
      recordingUrl: `mock://recordings/${request.tenantId}/${Date.now()}.mp3`,
    };
  }

  verifyWebhookSignature(): boolean {
    return process.env.NODE_ENV !== 'production';
  }
}

/**
 * Feature-hashing embedding: tokens are hashed into buckets and L2-normalized.
 * Cosine similarity then approximates lexical/semantic overlap — good enough for
 * RAG retrieval in dev/test and a drop-in seam for a real embedding model.
 */
export function hashingEmbedding(text: string, dimensions: number): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
  for (const token of tokens) {
    const hash = createHash('md5').update(token).digest();
    const bucket = hash.readUInt32BE(0) % dimensions;
    const sign = hash[4] % 2 === 0 ? 1 : -1;
    vector[bucket] += sign;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

/** Tiny deterministic PRNG (mulberry32) seeded from a string. */
function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
