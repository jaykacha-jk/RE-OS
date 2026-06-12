import { Injectable, Logger } from '@nestjs/common';

import type {
  EmbeddingProvider,
  EmbeddingResult,
  LLMProvider,
  LlmCompletionRequest,
  LlmCompletionResult,
  TranscriptionProvider,
  TranscriptionRequest,
  TranscriptionResult,
} from './ai-provider.types';
import { estimateTokens } from './mock.provider';

/**
 * OpenAI implementation of the LLM / Embedding / Transcription interfaces using
 * the REST API directly (no SDK dependency — keeps the dependency surface small
 * and the same fetch pattern works for Claude / Gemini / DeepSeek later).
 *
 * Telephony (VoiceProvider) is intentionally NOT implemented here — voice is a
 * separate concern handled by a dedicated telephony provider (Twilio / Exotel);
 * the provider factory composes voice independently.
 */
@Injectable()
export class OpenAiProvider implements LLMProvider, EmbeddingProvider, TranscriptionProvider {
  readonly name = 'openai';
  readonly model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  readonly dimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536);

  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';

  /** True only when an API key is configured — used by the factory to select. */
  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  private apiKey(): string {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not configured');
    return key;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const model = request.model ?? process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini';
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey()}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 800,
        ...(request.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI chat failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const body = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };
    const content = body.choices?.[0]?.message?.content ?? '';
    return {
      content,
      usage: {
        promptTokens: body.usage?.prompt_tokens ?? estimateTokens(JSON.stringify(request.messages)),
        completionTokens: body.usage?.completion_tokens ?? estimateTokens(content),
        totalTokens: body.usage?.total_tokens ?? 0,
      },
      model: body.model ?? model,
      provider: this.name,
    };
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey()}`,
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI embeddings failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const body = (await res.json()) as {
      data: Array<{ embedding: number[] }>;
      usage?: { total_tokens: number };
    };
    return {
      embedding: body.data?.[0]?.embedding ?? [],
      model: this.model,
      provider: this.name,
      tokens: body.usage?.total_tokens ?? estimateTokens(text),
    };
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    // Fetch the recording, then post to Whisper as multipart form data.
    const audioRes = await fetch(request.recordingUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to fetch recording (${audioRes.status})`);
    }
    const audioBlob = await audioRes.blob();
    const form = new FormData();
    form.append('file', audioBlob, 'recording.mp3');
    form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1');
    if (request.language) form.append('language', request.language);

    const res = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey()}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI transcription failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const body = (await res.json()) as { text: string };
    const transcript = body.text ?? '';
    return {
      transcript,
      // Whisper (without verbose timestamps) returns plain text; we keep a single
      // segment. Diarization can be layered later via verbose_json + a diarizer.
      segments: transcript
        ? [{ speaker: 'client' as const, content: transcript, offsetMs: 0 }]
        : [],
      provider: this.name,
      durationSeconds: 0,
      language: request.language,
    };
  }
}
