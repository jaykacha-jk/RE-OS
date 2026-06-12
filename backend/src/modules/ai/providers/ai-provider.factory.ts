import { Injectable, Logger } from '@nestjs/common';

import type { AiProviderBundle } from './ai-provider.types';
import { MockAiProvider } from './mock.provider';
import { OpenAiProvider } from './openai.provider';

export type AiProviderName = 'mock' | 'openai';

/**
 * Selects and composes the AI provider bundle for a request.
 *
 * Resolution order for the LLM/embedding/transcription provider:
 *   1. explicit per-tenant setting (ai_settings.provider),
 *   2. AI_PROVIDER env var,
 *   3. default 'mock'.
 *
 * If 'openai' is requested but no API key is configured, we transparently fall
 * back to 'mock' so the platform never hard-fails on a missing credential.
 *
 * Voice (telephony) is composed independently via VOICE_PROVIDER and currently
 * always resolves to the Mock voice provider until a real telephony integration
 * (Twilio / Exotel) is wired — keeping the seam vendor-neutral.
 */
@Injectable()
export class AiProviderFactory {
  private readonly logger = new Logger(AiProviderFactory.name);

  constructor(
    private readonly mock: MockAiProvider,
    private readonly openai: OpenAiProvider,
  ) {}

  resolveName(preferred?: string | null): AiProviderName {
    const requested = (preferred ?? process.env.AI_PROVIDER ?? 'mock').toLowerCase();
    if (requested === 'openai') {
      if (this.openai.isConfigured()) return 'openai';
      this.logger.warn('AI_PROVIDER=openai but OPENAI_API_KEY missing — falling back to mock');
      return 'mock';
    }
    return 'mock';
  }

  /** Build the capability bundle for a tenant (preferred provider optional). */
  bundle(preferred?: string | null): AiProviderBundle {
    const name = this.resolveName(preferred);
    if (name === 'openai') {
      return {
        name,
        llm: this.openai,
        embedding: this.openai,
        transcription: this.openai,
        // Telephony stays on the Mock voice provider until a real one is added.
        voice: this.mock,
      };
    }
    return {
      name,
      llm: this.mock,
      embedding: this.mock,
      transcription: this.mock,
      voice: this.mock,
    };
  }
}
