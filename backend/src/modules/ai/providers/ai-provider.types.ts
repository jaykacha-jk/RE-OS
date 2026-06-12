/**
 * Phase 10 — AI provider abstraction layer.
 *
 * Every AI capability is expressed as a narrow, vendor-neutral interface so the
 * platform never depends on a specific model vendor (no lock-in). Concrete
 * providers (OpenAI today; Claude / Gemini / DeepSeek next) implement these
 * interfaces. A deterministic Mock implements all of them so the platform runs,
 * builds, and tests without any API keys or network access.
 */

export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Request a strict JSON object response (provider may use JSON mode). */
  json?: boolean;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmCompletionResult {
  content: string;
  usage: LlmUsage;
  model: string;
  provider: string;
}

export interface LLMProvider {
  readonly name: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  provider: string;
  tokens: number;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimensions: number;
  embed(text: string): Promise<EmbeddingResult>;
}

export interface TranscriptSegment {
  speaker: 'agent' | 'client' | 'system';
  content: string;
  offsetMs: number;
  sentiment?: string;
}

export interface TranscriptionResult {
  transcript: string;
  segments: TranscriptSegment[];
  provider: string;
  durationSeconds: number;
  language?: string;
}

export interface TranscriptionRequest {
  recordingUrl: string;
  language?: string;
  /** Optional seed used by the Mock provider for deterministic transcripts. */
  seed?: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

export interface PlaceCallRequest {
  tenantId: string;
  toPhone: string;
  fromPhone?: string | null;
  agentName?: string;
  direction: 'inbound' | 'outbound';
  script?: string;
}

export interface PlaceCallResult {
  provider: string;
  callSid: string;
  status: string;
  recordingUrl?: string | null;
}

export interface VoiceProvider {
  readonly name: string;
  placeCall(request: PlaceCallRequest): Promise<PlaceCallResult>;
  verifyWebhookSignature(payload: string, signature: string | undefined): boolean;
}

/** A bundle of the four capabilities selected for a given tenant/request. */
export interface AiProviderBundle {
  name: string;
  llm: LLMProvider;
  embedding: EmbeddingProvider;
  transcription: TranscriptionProvider;
  voice: VoiceProvider;
}
