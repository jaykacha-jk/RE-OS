import { Injectable } from '@nestjs/common';

import { DEFAULT_HANDOFF_KEYWORDS } from '../ai.constants';
import { AiRepository } from '../ai.repository';
import { UpdateAiSettingsDto } from '../dto/ai-settings.dto';

export interface ResolvedAiSettings {
  provider: string;
  chat_enabled: boolean;
  voice_enabled: boolean;
  auto_qualify: boolean;
  auto_create_inquiry: boolean;
  auto_followups: boolean;
  handoff_keywords: string[];
  default_language: string;
  configuration: Record<string, unknown>;
}

@Injectable()
export class AiSettingsService {
  constructor(private readonly repo: AiRepository) {}

  async resolve(tenantId: string): Promise<ResolvedAiSettings> {
    const row = await this.repo.getSettings(tenantId);
    return {
      provider: row?.provider ?? process.env.AI_PROVIDER ?? 'mock',
      chat_enabled: row?.chat_enabled ?? true,
      voice_enabled: row?.voice_enabled ?? true,
      auto_qualify: row?.auto_qualify ?? true,
      auto_create_inquiry: row?.auto_create_inquiry ?? true,
      auto_followups: row?.auto_followups ?? true,
      handoff_keywords:
        (row?.handoff_keywords as string[] | null)?.length
          ? (row!.handoff_keywords as string[])
          : DEFAULT_HANDOFF_KEYWORDS,
      default_language: row?.default_language ?? 'en',
      configuration: (row?.configuration as Record<string, unknown>) ?? {},
    };
  }

  async update(tenantId: string, dto: UpdateAiSettingsDto): Promise<ResolvedAiSettings> {
    await this.repo.upsertSettings(tenantId, {
      ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
      ...(dto.chat_enabled !== undefined ? { chat_enabled: dto.chat_enabled } : {}),
      ...(dto.voice_enabled !== undefined ? { voice_enabled: dto.voice_enabled } : {}),
      ...(dto.auto_qualify !== undefined ? { auto_qualify: dto.auto_qualify } : {}),
      ...(dto.auto_create_inquiry !== undefined ? { auto_create_inquiry: dto.auto_create_inquiry } : {}),
      ...(dto.auto_followups !== undefined ? { auto_followups: dto.auto_followups } : {}),
      ...(dto.handoff_keywords !== undefined ? { handoff_keywords: dto.handoff_keywords } : {}),
      ...(dto.default_language !== undefined ? { default_language: dto.default_language } : {}),
      ...(dto.configuration !== undefined
        ? { configuration: dto.configuration as object }
        : {}),
    });
    return this.resolve(tenantId);
  }
}
