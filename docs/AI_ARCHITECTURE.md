# AI Architecture — Phase 10 (AI Agent Platform)

**Status:** Implemented · **Last updated:** 2026-06-10

The AI Agent Platform adds voice + chat agents, lead qualification, property
matching, follow-up automation, conversation intelligence, and a vector
knowledge layer to RE-OS. It is built as a NestJS module (`modules/ai`) that
follows the existing Controller → Service → Repository layering, scopes every
query by `tenant_id`, and **enhances the CRM rather than replacing it**.

---

## 1. Design principles

1. **No vendor lock-in.** Every model interaction goes through a provider
   interface. The default is a deterministic `MockProvider` that runs fully
   offline (no API keys); `OpenAIProvider` is the first real implementation.
   Claude / Gemini / DeepSeek slot in by implementing the same interfaces.
2. **AI enhances the CRM.** Qualification writes `lead_score` + `temperature`
   back to the inquiry, adds a note, and records a history entry + audit log.
   Humans stay in control; chat escalates to a human on handoff keywords.
3. **Deterministic heuristics under the hood.** Rule-based engines
   (qualification, matching, intelligence) produce structured output even with
   the mock provider, so the platform is testable and demoable without spend.
4. **Tenant isolation + RBAC.** All endpoints sit behind `JwtAuthGuard`,
   `TenantGuard`, and `RequirePermissions`. Usage + cost are metered per tenant.

---

## 2. Module layout

```
backend/src/modules/ai/
  ai.module.ts                 # wiring (imports AuditModule, CrmModule)
  ai.controller.ts             # AiController, AiAgents/Calls/Chat controllers
  ai-config.controller.ts      # Knowledge, Prompts, Followups, Settings, Webhook
  ai.constants.ts              # permissions, scoring weights, thresholds, keys
  ai.repository.ts             # all Prisma access (tenant-scoped)
  dto/                         # request validation
  engines/
    qualification.engine.ts    # requirement extraction + lead scoring
    matching.engine.ts         # property scoring + reasoning
    intelligence.engine.ts     # summary, signals, objections, risks, actions
    vector.util.ts             # cosine similarity + ranking (RAG)
  providers/
    ai-provider.types.ts       # LLM / Voice / Transcription / Embedding ifaces
    ai-provider.factory.ts     # resolves a provider bundle per tenant
    mock.provider.ts           # offline deterministic bundle (128-dim hashing)
    openai.provider.ts         # OpenAI implementation
  services/                    # qualify, match, chat, call, followup,
                               # intelligence, analytics, prompt, settings,
                               # knowledge, usage
```

---

## 3. Provider abstraction

Four interfaces (`ai-provider.types.ts`):

| Interface | Responsibility | Mock | OpenAI |
|-----------|----------------|------|--------|
| `LLMProvider` | `complete(messages, opts)` chat/completions | contextual canned replies | chat completions |
| `EmbeddingProvider` | `embed(text)` → vector + tokens | 128-dim feature hashing (md5) | `text-embedding-3-*` |
| `TranscriptionProvider` | `transcribe(audio)` → diarized text | scripted transcript | Whisper |
| `VoiceProvider` | `placeCall()` / event normalization | simulated call lifecycle | (Twilio/Exotel adapter seam) |

`AiProviderFactory.bundle(provider)` returns an `AiProviderBundle` selected from
tenant `ai_settings.provider` (falls back to `OPENAI_API_KEY` presence, then
`mock`). Switching providers never breaks retrieval because embeddings are
compared only when dimensions match (`rankByEmbedding`).

---

## 4. Data model (Prisma)

| Table | Purpose |
|-------|---------|
| `ai_agents` | Voice/chat agent config (phone number, provider, status, configuration) |
| `ai_calls` | Call record: sid, direction, duration, recording, transcript, summary, sentiment, qualification_score, temperature, next_action, extracted |
| `ai_conversations` | Chat sessions (channel, message log, captured requirements, handoff state) |
| `ai_knowledge_documents` | RAG corpus: type, title, content, embedding, embedding_model, tokens |
| `ai_prompt_templates` | System prompts per capability (system default + tenant override) |
| `ai_settings` | Per-tenant provider + automation toggles + handoff keywords |
| `ai_followup_suggestions` | Generated next actions (type, channel, priority, status, reasoning) |
| `ai_usage_events` | Cost/usage metering per feature + provider + model |

All carry `tenant_id` and (where applicable) `deleted_at` for soft delete.

---

## 5. Core workflows

### Lead qualification (`POST /ai/qualify`)
Extract budget, city, area, property type, requirement type, bedrooms,
timeline, financing need → weighted score (0–100) → `hot` / `warm` / `cold`.
When `auto_qualify` is on (or `apply: true`), writes back to the inquiry via
`CrmService.applyAiQualification` (score + temperature + note + history + audit).

### Property matching (`POST /ai/match`)
Resolves criteria from an inquiry id or free text, fetches matchable
tenant properties, scores each (budget fit, location, type, bedrooms) and
returns ranked matches with human-readable reasons. Relaxes filters if a strict
query returns nothing.

### Conversation intelligence (`POST /ai/intelligence`)
Analyzes free text, a call transcript, or a chat conversation → summary,
buying signals, objections, risk indicators, recommended actions, sentiment.

### AI chat assistant (`POST /ai/chat`, `POST /ai/chat/:id/messages`)
RAG retrieval over the knowledge base → LLM reply → handoff detection on
keywords → lead-requirement capture. WhatsApp-ready via the `channel` field.

### AI voice agent (`POST /ai/calls`, webhook `POST /ai/webhooks/voice`)
Outbound call with consent check → telephony webhook events → post-call
pipeline: transcription → qualification → intelligence → CRM update →
follow-up suggestion → usage metering.

### Follow-up automation (`POST /ai/followups/generate`)
Generates reminders/re-engagement for a specific inquiry or by scanning stale
open inquiries.

---

## 6. RBAC

| Permission | Owner | Admin | Manager | Sales |
|------------|:-----:|:-----:|:-------:|:-----:|
| `ai.dashboard.read` / `ai.analytics.read` | ✓ | ✓ | ✓ | — |
| `ai.qualify` / `ai.match` / `ai.intelligence` | ✓ | ✓ | ✓ | ✓ |
| `ai.chat` | ✓ | ✓ | ✓ | ✓ |
| `ai.calls.read` / `ai.calls.create` | ✓ | ✓ | ✓ | own |
| `ai.knowledge.read` | ✓ | ✓ | ✓ | ✓ |
| `ai.knowledge.manage` / `ai.prompts.manage` | ✓ | ✓ | — | — |
| `ai.settings.read` / `ai.settings.manage` | ✓ | ✓ | read | — |
| `ai.followups.read` / `ai.followups.manage` | ✓ | ✓ | ✓ | own |

Plan gating: `max_ai_minutes_monthly` per plan; `ai` feature flag on
starter/pro/enterprise. Voice calls disclose recording consent (BR-AI06).

---

## 7. Cost & analytics

`AiUsageService` records an `ai_usage_events` row for every model call
(feature, provider, model, prompt/completion/total tokens). `AiAnalyticsService`
aggregates conversations, conversions, qualification/handoff rates, call
outcomes, token totals, estimated cost, and **cost per lead** for the dashboard.

---

## 8. Extending to a new provider

1. Implement the four interfaces in `providers/<name>.provider.ts`.
2. Register the bundle in `AiProviderFactory`.
3. Add the provider value to `ai_settings.provider` options + settings UI.
4. No engine, service, controller, or schema changes required.

---

## 9. Known limitations

- Mock embeddings approximate **lexical** overlap (feature hashing), not deep
  semantics — sufficient for dev/test/demo RAG; OpenAI embeddings give true
  semantic retrieval in production.
- `VoiceProvider` ships with a simulated call lifecycle; a real telephony
  adapter (Twilio/Exotel) plugs into the same webhook contract.
- BullMQ async work requires Redis ≥ 5 (dev fallback logs a version warning).
