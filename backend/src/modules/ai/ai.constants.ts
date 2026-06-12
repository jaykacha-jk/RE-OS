/**
 * Phase 10 — AI Agent Platform constants.
 *
 * Permission codes, business-rule weights, and shared enums. Business rules are
 * coded (BR-AI*) so service exceptions and analytics can reference them.
 */

export const AI_PERMISSIONS = {
  DASHBOARD_READ: 'ai.dashboard.read',
  CALLS_READ: 'ai.calls.read',
  CALLS_CREATE: 'ai.calls.create',
  AGENTS_MANAGE: 'ai.agents.manage',
  CHAT_USE: 'ai.chat.use',
  QUALIFY: 'ai.qualify',
  MATCH: 'ai.match',
  INTELLIGENCE_READ: 'ai.intelligence.read',
  FOLLOWUPS_READ: 'ai.followups.read',
  FOLLOWUPS_MANAGE: 'ai.followups.manage',
  KNOWLEDGE_READ: 'ai.knowledge.read',
  KNOWLEDGE_MANAGE: 'ai.knowledge.manage',
  PROMPTS_MANAGE: 'ai.prompts.manage',
  SETTINGS_READ: 'ai.settings.read',
  SETTINGS_MANAGE: 'ai.settings.manage',
  ANALYTICS_READ: 'ai.analytics.read',
} as const;

export const ALL_AI_PERMISSIONS = Object.values(AI_PERMISSIONS);

/** Roles that see all AI data org-wide vs. only their own conversations. */
export const AI_FULL_ACCESS_ROLES = ['super_admin', 'org_owner', 'org_admin'];
export const AI_MANAGE_ROLES = ['super_admin', 'org_owner', 'org_admin', 'sales_manager'];

/**
 * Lead score weights (0–100). Mirrors docs/AI_AGENT_SPEC.md §3.
 * BR-AI01: qualification score is the weighted sum of these signals.
 */
export const LEAD_SCORE_WEIGHTS = {
  budget: 25,
  timeline: 25,
  requirement: 25,
  engagement: 25,
} as const;

/** BR-AI02: score → temperature classification thresholds. */
export const TEMPERATURE_THRESHOLDS = { hot: 70, warm: 40 } as const;

/** BR-AI04: only auto-apply extraction to CRM at/above this confidence. */
export const MIN_EXTRACTION_CONFIDENCE = 0.7;

export type LeadTemperature = 'hot' | 'warm' | 'cold';
export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'cancelled';
export type CallDirection = 'inbound' | 'outbound';
export type Sentiment = 'positive' | 'neutral' | 'negative';

export const PROMPT_KEYS = {
  QUALIFICATION: 'qualification',
  MATCHING: 'matching',
  CHAT_ASSISTANT: 'chat_assistant',
  CALL_SUMMARY: 'call_summary',
  INTELLIGENCE: 'intelligence',
  FOLLOWUP: 'followup',
} as const;

export const KNOWLEDGE_TYPES = ['property', 'faq', 'policy', 'document'] as const;
export const FOLLOWUP_TYPES = [
  'call_reminder',
  'visit_reminder',
  're_engagement',
  'missed_inquiry',
] as const;

/** Default phrases that trigger AI → human handoff (BR-AI05). */
export const DEFAULT_HANDOFF_KEYWORDS = [
  'talk to a human',
  'speak to agent',
  'real person',
  'call me',
  'complaint',
  'not helpful',
];

/** AI usage features (for ai_usage_events.feature + analytics). */
export const AI_FEATURES = {
  QUALIFICATION: 'qualification',
  MATCHING: 'matching',
  CHAT: 'chat',
  CALL: 'call',
  INTELLIGENCE: 'intelligence',
  EMBEDDING: 'embedding',
  FOLLOWUP: 'followup',
} as const;
