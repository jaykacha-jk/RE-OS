import { apiFetch } from './api';
import { getSession } from './auth';

function token() {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.access_token;
}

function qs(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function isRealVoiceProviderAvailable() {
  return ['twilio', 'exotel'].includes((process.env.NEXT_PUBLIC_VOICE_PROVIDER ?? '').toLowerCase());
}

// --- Types -------------------------------------------------------------------

export type AiDashboard = {
  range: string;
  ai_conversations: number;
  ai_conversions: number;
  calls_total: number;
  calls_completed: number;
  qualified_calls: number;
  qualification_rate: number;
  conversion_rate: number;
  handoff_rate: number;
  knowledge_documents: number;
  total_tokens: number;
  estimated_cost_usd: number;
  cost_per_lead_usd: number;
  temperature_breakdown: { temperature: string | null; count: number }[];
};

export type AiSettings = {
  provider: string;
  chat_enabled: boolean;
  voice_enabled: boolean;
  auto_qualify: boolean;
  auto_create_inquiry: boolean;
  auto_followups: boolean;
  handoff_keywords: string[];
  default_language: string;
  configuration: Record<string, unknown>;
};

export type AiCallSummary = {
  id: string;
  client_phone: string;
  client_name: string | null;
  direction: string;
  status: string;
  duration_seconds: number;
  sentiment: string | null;
  qualification_score: number | null;
  temperature: string | null;
  agent: { id: string; name: string } | null;
  created_at: string;
};

export type AiCallDetail = AiCallSummary & {
  inquiry_id: string | null;
  provider: string;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  next_action: string | null;
  extracted: Record<string, unknown>;
  consent_recorded: boolean;
  segments: { speaker: string; content: string; sentiment: string | null; offset_ms: number }[];
};

export type Paginated<T> = { data: T[]; meta: { page: number; per_page: number; total: number; total_pages: number } };

export type AiKnowledgeDoc = {
  id: string;
  type: string;
  title: string;
  content: string;
  is_active: boolean;
  embedding_model: string | null;
  updated_at: string;
};

export type AiPrompt = {
  id: string;
  tenant_id: string | null;
  key: string;
  name: string;
  description: string | null;
  system_prompt: string;
  is_active: boolean;
  scope: string;
};

export type AiFollowup = {
  id: string;
  inquiry_id: string | null;
  type: string;
  channel: string;
  title: string;
  message: string;
  priority: string;
  status: string;
  reasoning: string | null;
  due_at: string | null;
  created_at: string;
};

export type QualifyResult = {
  extracted: Record<string, unknown>;
  score: number;
  breakdown: Record<string, number>;
  temperature: string;
  applied: boolean;
  applied_reason: string;
};

export type MatchResult = {
  criteria: Record<string, unknown>;
  matches: {
    property_id: string;
    title: string;
    property_code: string;
    city: string | null;
    price: number | null;
    bedrooms: number | null;
    match_score: number;
    reasons: string[];
  }[];
};

export type IntelligenceResult = {
  summary: string;
  objections: string[];
  buying_signals: string[];
  risk_indicators: string[];
  recommended_actions: string[];
  sentiment: string;
  source: string;
};

export type AiChatReply = {
  ai_conversation_id: string;
  reply: string;
  handoff_requested: boolean;
  sources: { id: string; title: string; score: number }[];
  captured_requirements: Record<string, unknown>;
};

// --- API ---------------------------------------------------------------------

export async function fetchAiDashboard(range = '30d') {
  return (await apiFetch<AiDashboard>(`/api/v1/ai/dashboard${qs({ range })}`, { token: token() })).data;
}

export async function fetchAiSettings() {
  return (await apiFetch<AiSettings>('/api/v1/ai/settings', { token: token() })).data;
}

export async function updateAiSettings(patch: Partial<AiSettings>) {
  return (
    await apiFetch<AiSettings>('/api/v1/ai/settings', {
      token: token(),
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function fetchAiCalls(params: { status?: string; direction?: string; search?: string; page?: number; per_page?: number } = {}) {
  return (await apiFetch<Paginated<AiCallSummary>>(`/api/v1/ai/calls${qs(params)}`, { token: token() })).data;
}

export async function fetchAiCall(id: string) {
  return (await apiFetch<AiCallDetail>(`/api/v1/ai/calls/${id}`, { token: token() })).data;
}

export async function initiateAiCall(body: {
  client_phone: string;
  client_name?: string;
  direction?: string;
  inquiry_id?: string;
  consent_recorded?: boolean;
}) {
  return (
    await apiFetch<AiCallDetail>('/api/v1/ai/calls', {
      token: token(),
      method: 'POST',
      body: JSON.stringify({ consent_recorded: true, ...body }),
    })
  ).data;
}

export async function fetchAiKnowledge(params: { search?: string; type?: string; page?: number; per_page?: number } = {}) {
  return (await apiFetch<Paginated<AiKnowledgeDoc>>(`/api/v1/ai/knowledge${qs(params)}`, { token: token() })).data;
}

export async function createAiKnowledge(body: { title: string; content: string; type?: string }) {
  return (
    await apiFetch<AiKnowledgeDoc>('/api/v1/ai/knowledge', {
      token: token(),
      method: 'POST',
      body: JSON.stringify(body),
    })
  ).data;
}

export async function deleteAiKnowledge(id: string) {
  return (await apiFetch(`/api/v1/ai/knowledge/${id}`, { token: token(), method: 'DELETE' })).data;
}

export async function searchAiKnowledge(query: string) {
  return (
    await apiFetch<{ id: string; title: string; content: string; type: string; score: number }[]>(
      '/api/v1/ai/knowledge/search',
      { token: token(), method: 'POST', body: JSON.stringify({ query }) },
    )
  ).data;
}

export async function fetchAiPrompts() {
  return (await apiFetch<AiPrompt[]>('/api/v1/ai/prompts', { token: token() })).data;
}

export async function upsertAiPrompt(body: { key: string; name: string; system_prompt: string; description?: string }) {
  return (
    await apiFetch<AiPrompt>('/api/v1/ai/prompts', {
      token: token(),
      method: 'POST',
      body: JSON.stringify(body),
    })
  ).data;
}

export async function fetchAiFollowups(params: { status?: string; page?: number } = {}) {
  return (await apiFetch<Paginated<AiFollowup>>(`/api/v1/ai/followups${qs(params)}`, { token: token() })).data;
}

export async function generateAiFollowups(body: { inquiry_id?: string } = {}) {
  return (
    await apiFetch<{ generated: number; suggestions: unknown[] }>('/api/v1/ai/followups/generate', {
      token: token(),
      method: 'POST',
      body: JSON.stringify(body),
    })
  ).data;
}

export async function updateAiFollowupStatus(id: string, status: 'accepted' | 'dismissed' | 'applied') {
  return (
    await apiFetch<AiFollowup>(`/api/v1/ai/followups/${id}`, {
      token: token(),
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  ).data;
}

export async function qualifyLead(body: { text: string; inquiry_id?: string; apply?: boolean }) {
  return (
    await apiFetch<QualifyResult>('/api/v1/ai/qualify', {
      token: token(),
      method: 'POST',
      body: JSON.stringify(body),
    })
  ).data;
}

export async function matchProperties(body: { text?: string; inquiry_id?: string; limit?: number }) {
  return (
    await apiFetch<MatchResult>('/api/v1/ai/match', {
      token: token(),
      method: 'POST',
      body: JSON.stringify(body),
    })
  ).data;
}

export async function analyzeConversation(body: { text?: string; call_id?: string }) {
  return (
    await apiFetch<IntelligenceResult>('/api/v1/ai/intelligence', {
      token: token(),
      method: 'POST',
      body: JSON.stringify(body),
    })
  ).data;
}

export async function startAiChat(body: { message?: string; channel?: string }) {
  return (
    await apiFetch<AiChatReply | { ai_conversation_id: string }>('/api/v1/ai/chat', {
      token: token(),
      method: 'POST',
      body: JSON.stringify(body),
    })
  ).data;
}

export async function sendAiChatMessage(id: string, message: string) {
  return (
    await apiFetch<AiChatReply>(`/api/v1/ai/chat/${id}/messages`, {
      token: token(),
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  ).data;
}

export function temperatureColor(t: string | null) {
  if (t === 'hot') return 'bg-red-100 text-red-700';
  if (t === 'warm') return 'bg-amber-100 text-amber-700';
  if (t === 'cold') return 'bg-sky-100 text-sky-700';
  return 'bg-slate-100 text-slate-600';
}
