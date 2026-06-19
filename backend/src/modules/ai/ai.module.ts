import { Module } from '@nestjs/common';

import { FeatureFlagsModule } from '../../common/feature-flags.module';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { CrmModule } from '../crm/crm.module';
import {
  AiAgentsController,
  AiCallsController,
  AiChatController,
  AiController,
} from './ai.controller';
import {
  AiFollowupsController,
  AiKnowledgeController,
  AiPromptsController,
  AiSettingsController,
  AiWebhookController,
} from './ai-config.controller';
import { AiRepository } from './ai.repository';
import { AiProviderFactory } from './providers/ai-provider.factory';
import { MockAiProvider } from './providers/mock.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { AiAnalyticsService } from './services/ai-analytics.service';
import { AiCallService } from './services/ai-call.service';
import { AiChatService } from './services/ai-chat.service';
import { AiSettingsService } from './services/ai-settings.service';
import { AiUsageService } from './services/ai-usage.service';
import { ConversationIntelligenceService } from './services/conversation-intelligence.service';
import { FollowupAutomationService } from './services/followup-automation.service';
import { KnowledgeBaseService } from './services/knowledge-base.service';
import { LeadQualificationService } from './services/lead-qualification.service';
import { PromptService } from './services/prompt.service';
import { PropertyMatchingService } from './services/property-matching.service';

/**
 * Phase 10 — AI Agent Platform.
 *
 * Provider-abstracted AI layer (LLM / Voice / Transcription / Embedding) with a
 * deterministic Mock so everything runs without API keys. AI *enhances* the CRM
 * (via CrmService) — it never writes CRM entities directly from here.
 */
@Module({
  imports: [AuditModule, BillingModule, CrmModule, FeatureFlagsModule],
  controllers: [
    AiController,
    AiAgentsController,
    AiCallsController,
    AiChatController,
    AiKnowledgeController,
    AiPromptsController,
    AiFollowupsController,
    AiSettingsController,
    AiWebhookController,
  ],
  providers: [
    AiRepository,
    MockAiProvider,
    OpenAiProvider,
    AiProviderFactory,
    AiSettingsService,
    AiUsageService,
    PromptService,
    KnowledgeBaseService,
    LeadQualificationService,
    PropertyMatchingService,
    ConversationIntelligenceService,
    AiChatService,
    AiCallService,
    FollowupAutomationService,
    AiAnalyticsService,
  ],
  exports: [AiProviderFactory, LeadQualificationService, PropertyMatchingService],
})
export class AiModule {}
