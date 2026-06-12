import type { Sentiment } from '../ai.constants';

export interface IntelligenceResult {
  summary: string;
  objections: string[];
  buying_signals: string[];
  risk_indicators: string[];
  recommended_actions: string[];
  sentiment: Sentiment;
}

const OBJECTION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /too expensive|over budget|can't afford|costly|out of (?:my )?budget/i, label: 'Price concern — over budget' },
  { re: /need to (?:think|discuss)|talk to (?:my )?(?:wife|husband|family|partner)/i, label: 'Decision deferred to family/partner' },
  { re: /loan|emi|financ|down ?payment/i, label: 'Financing dependency' },
  { re: /far|distance|location is|too far|commute/i, label: 'Location/commute concern' },
  { re: /not sure|maybe|might|undecided|confused/i, label: 'Low certainty / undecided' },
  { re: /possession|ready to move|under construction|delay/i, label: 'Possession timeline concern' },
];

const BUYING_SIGNAL_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /site visit|visit the|come and see|show me|schedule/i, label: 'Requested a site visit' },
  { re: /book|booking|token|advance|finalize|proceed/i, label: 'Ready to book / pay token' },
  { re: /immediate|asap|this month|urgent|soon/i, label: 'Urgent timeline' },
  { re: /pre-?approved|loan (?:is )?(?:ready|sanctioned|approved)/i, label: 'Financing arranged' },
  { re: /interested|love it|perfect|exactly what/i, label: 'Strong interest expressed' },
];

const RISK_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /just (?:looking|browsing|exploring)|no rush|window shopping/i, label: 'Low intent — exploring only' },
  { re: /other (?:agent|broker|builder)|comparing|elsewhere/i, label: 'Engaging with competitors' },
  { re: /angry|frustrat|disappointed|worst|complaint/i, label: 'Negative sentiment / dissatisfaction' },
  { re: /stop calling|do not call|not interested|remove (?:my|me)/i, label: 'Opt-out / disengagement risk' },
];

const POSITIVE = /interested|great|perfect|love|good|yes|sure|book|visit|happy/gi;
const NEGATIVE = /no|not|expensive|far|delay|problem|worst|angry|disappoint|cancel/gi;

export function detectSentiment(text: string): Sentiment {
  const pos = (text.match(POSITIVE) ?? []).length;
  const neg = (text.match(NEGATIVE) ?? []).length;
  if (pos > neg + 1) return 'positive';
  if (neg > pos + 1) return 'negative';
  return 'neutral';
}

function matchAll(text: string, patterns: Array<{ re: RegExp; label: string }>): string[] {
  const found: string[] = [];
  for (const { re, label } of patterns) {
    if (re.test(text) && !found.includes(label)) found.push(label);
  }
  return found;
}

function buildSummary(text: string): string {
  const firstSentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s/)
    .slice(0, 2)
    .join(' ')
    .trim();
  return firstSentences ? firstSentences.slice(0, 400) : 'No substantive conversation content.';
}

function recommendActions(
  objections: string[],
  signals: string[],
  risks: string[],
  sentiment: Sentiment,
): string[] {
  const actions: string[] = [];
  if (signals.some((s) => /site visit/i.test(s))) actions.push('Schedule the requested site visit within 24 hours');
  if (signals.some((s) => /book|token/i.test(s))) actions.push('Send booking details and reserve a token slot');
  if (objections.some((o) => /financing|loan/i.test(o))) actions.push('Connect the client with a home-loan partner');
  if (objections.some((o) => /price|budget/i.test(o))) actions.push('Share options in a lower budget band or negotiate');
  if (risks.some((r) => /opt-out|disengagement/i.test(r))) actions.push('Pause outreach and respect opt-out (TRAI compliance)');
  if (risks.some((r) => /competitor/i.test(r))) actions.push('Differentiate with USPs and a time-bound offer');
  if (sentiment === 'negative') actions.push('Escalate to a senior advisor for relationship recovery');
  if (!actions.length) actions.push('Follow up with curated property recommendations');
  return actions;
}

/** Pure rule-based conversation intelligence over a transcript/chat log. */
export function analyzeConversation(text: string): IntelligenceResult {
  const objections = matchAll(text, OBJECTION_PATTERNS);
  const buying_signals = matchAll(text, BUYING_SIGNAL_PATTERNS);
  const risk_indicators = matchAll(text, RISK_PATTERNS);
  const sentiment = detectSentiment(text);
  return {
    summary: buildSummary(text),
    objections,
    buying_signals,
    risk_indicators,
    recommended_actions: recommendActions(objections, buying_signals, risk_indicators, sentiment),
    sentiment,
  };
}
