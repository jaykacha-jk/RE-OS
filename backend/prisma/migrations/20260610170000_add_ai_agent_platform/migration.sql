-- Phase 10: AI Agent Platform
-- Voice agent, chat assistant, lead qualification, property matching,
-- follow-up automation, conversation intelligence, and a vector knowledge layer.
-- Cross-aggregate references (inquiry_id, conversation_id) are plain columns;
-- tenant_id carries a DB-level foreign key for integrity.

-- AI agents (voice + chat assistant configurations)
CREATE TABLE IF NOT EXISTS "ai_agents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'voice',
  "phone_number" TEXT,
  "call_provider" TEXT NOT NULL DEFAULT 'mock',
  "status" TEXT NOT NULL DEFAULT 'active',
  "configuration" JSONB NOT NULL DEFAULT '{}',
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "ai_agents_tenant_id_idx" ON "ai_agents"("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_agents_tenant_type_idx" ON "ai_agents"("tenant_id", "type");
CREATE INDEX IF NOT EXISTS "ai_agents_deleted_at_idx" ON "ai_agents"("deleted_at");

-- AI calls (inbound/outbound voice interactions)
CREATE TABLE IF NOT EXISTS "ai_calls" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "agent_id" UUID REFERENCES "ai_agents"("id"),
  "inquiry_id" UUID,
  "call_sid" TEXT,
  "client_phone" TEXT NOT NULL,
  "client_name" TEXT,
  "direction" TEXT NOT NULL DEFAULT 'outbound',
  "status" TEXT NOT NULL DEFAULT 'queued',
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "duration_seconds" INTEGER NOT NULL DEFAULT 0,
  "recording_url" TEXT,
  "transcript" TEXT,
  "summary" TEXT,
  "sentiment" TEXT,
  "qualification_score" INTEGER,
  "temperature" TEXT,
  "extracted" JSONB NOT NULL DEFAULT '{}',
  "next_action" TEXT,
  "consent_recorded" BOOLEAN NOT NULL DEFAULT false,
  "error" TEXT,
  "started_at" TIMESTAMPTZ,
  "ended_at" TIMESTAMPTZ,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "ai_calls_tenant_id_idx" ON "ai_calls"("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_calls_tenant_status_idx" ON "ai_calls"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "ai_calls_tenant_created_idx" ON "ai_calls"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_calls_inquiry_id_idx" ON "ai_calls"("inquiry_id");
CREATE INDEX IF NOT EXISTS "ai_calls_agent_id_idx" ON "ai_calls"("agent_id");
CREATE INDEX IF NOT EXISTS "ai_calls_deleted_at_idx" ON "ai_calls"("deleted_at");

-- AI call transcripts (per-utterance, diarized)
CREATE TABLE IF NOT EXISTS "ai_call_transcripts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "call_id" UUID NOT NULL REFERENCES "ai_calls"("id") ON DELETE CASCADE,
  "speaker" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "sentiment" TEXT,
  "offset_ms" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ai_call_transcripts_call_offset_idx" ON "ai_call_transcripts"("call_id", "offset_ms");
CREATE INDEX IF NOT EXISTS "ai_call_transcripts_tenant_id_idx" ON "ai_call_transcripts"("tenant_id");

-- AI conversations (chat assistant sessions)
CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "conversation_id" UUID,
  "inquiry_id" UUID,
  "channel" TEXT NOT NULL DEFAULT 'website',
  "status" TEXT NOT NULL DEFAULT 'active',
  "client_name" TEXT,
  "client_phone" TEXT,
  "summary" TEXT,
  "handoff_requested" BOOLEAN NOT NULL DEFAULT false,
  "messages_count" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "ai_conversations_tenant_id_idx" ON "ai_conversations"("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_conversations_tenant_status_idx" ON "ai_conversations"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "ai_conversations_conversation_id_idx" ON "ai_conversations"("conversation_id");
CREATE INDEX IF NOT EXISTS "ai_conversations_inquiry_id_idx" ON "ai_conversations"("inquiry_id");
CREATE INDEX IF NOT EXISTS "ai_conversations_deleted_at_idx" ON "ai_conversations"("deleted_at");

-- AI messages (chat assistant turns)
CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "ai_conversation_id" UUID NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "tokens" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ai_messages_conversation_created_idx" ON "ai_messages"("ai_conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_messages_tenant_id_idx" ON "ai_messages"("tenant_id");

-- AI knowledge documents (vector knowledge layer for RAG)
CREATE TABLE IF NOT EXISTS "ai_knowledge_documents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "type" TEXT NOT NULL DEFAULT 'document',
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "source_type" TEXT,
  "source_id" TEXT,
  "embedding" JSONB NOT NULL DEFAULT '[]',
  "embedding_model" TEXT,
  "tokens" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "ai_knowledge_tenant_id_idx" ON "ai_knowledge_documents"("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_knowledge_tenant_type_idx" ON "ai_knowledge_documents"("tenant_id", "type");
CREATE INDEX IF NOT EXISTS "ai_knowledge_tenant_active_idx" ON "ai_knowledge_documents"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "ai_knowledge_deleted_at_idx" ON "ai_knowledge_documents"("deleted_at");

-- AI prompt templates (system + per-tenant overrides)
CREATE TABLE IF NOT EXISTS "ai_prompt_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "system_prompt" TEXT NOT NULL,
  "user_prompt_template" TEXT,
  "model" TEXT,
  "temperature" DECIMAL(3,2),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_prompt_templates_tenant_key_key" ON "ai_prompt_templates"("tenant_id", "key");
CREATE INDEX IF NOT EXISTS "ai_prompt_templates_tenant_id_idx" ON "ai_prompt_templates"("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_prompt_templates_key_idx" ON "ai_prompt_templates"("key");

-- AI settings (one row per tenant)
CREATE TABLE IF NOT EXISTS "ai_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "chat_enabled" BOOLEAN NOT NULL DEFAULT true,
  "voice_enabled" BOOLEAN NOT NULL DEFAULT true,
  "auto_qualify" BOOLEAN NOT NULL DEFAULT true,
  "auto_create_inquiry" BOOLEAN NOT NULL DEFAULT true,
  "auto_followups" BOOLEAN NOT NULL DEFAULT true,
  "handoff_keywords" JSONB NOT NULL DEFAULT '[]',
  "default_language" TEXT NOT NULL DEFAULT 'en',
  "configuration" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_settings_tenant_id_key" ON "ai_settings"("tenant_id");

-- AI follow-up suggestions
CREATE TABLE IF NOT EXISTS "ai_followup_suggestions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "inquiry_id" UUID,
  "call_id" UUID,
  "type" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'call',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "due_at" TIMESTAMPTZ,
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'suggested',
  "reasoning" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ai_followup_tenant_id_idx" ON "ai_followup_suggestions"("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_followup_tenant_status_idx" ON "ai_followup_suggestions"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "ai_followup_inquiry_id_idx" ON "ai_followup_suggestions"("inquiry_id");

-- AI usage events (analytics + cost tracking)
CREATE TABLE IF NOT EXISTS "ai_usage_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "feature" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "model" TEXT,
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "cost_usd" DECIMAL(12,6),
  "duration_ms" INTEGER NOT NULL DEFAULT 0,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "outcome" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ai_usage_tenant_feature_created_idx" ON "ai_usage_events"("tenant_id", "feature", "created_at");
CREATE INDEX IF NOT EXISTS "ai_usage_tenant_created_idx" ON "ai_usage_events"("tenant_id", "created_at");
