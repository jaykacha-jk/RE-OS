# AI Calling — Agent Skill

## Domain Knowledge

AI calling automates lead qualification via telephony + voice AI. Calls produce recordings, Whisper transcripts, GPT summaries, structured extraction, and lead scores.

**Quota:** Pro plan 500 minutes/month; tracked in organization_usage

## Business Workflow

1. Telecaller/Executive enters phone + optional inquiry link
2. Compliance: consent flag, DND check
3. Call initiated via telephony provider
4. On complete: recording → S3; queue transcribe → summarize → extract
5. If confidence ≥0.8: update inquiry fields + lead_score
6. Notify assignee with next action

## Entity Relationships

```
ai_calls *──1 inquiries (optional)
ai_calls 1──1 ai_call_transcripts
ai_calls ── created_by employee
organization_usage.ai_minutes_used incremented
```

## Validation Rules

- BR-AI01 consent for outbound
- BR-AI02 bill on connect; failed <10s free
- BR-AI04 auto-fill threshold 0.8
- BR-AI05 DND check
- BR-AI06 recording retention 90 days default

## Common Edge Cases

- Call dropped mid-transcript → partial save + retry job
- Wrong number / voicemail → status failed; no minute charge if <10s
- Multi-language (Hindi/Gujarati) → Whisper language hint
- OpenAI rate limit → exponential backoff queue

## API Considerations

- `POST /ai/calls` returns 202 Accepted (async initiation)
- Transcript endpoint separate when ready
- Recording URL signed short-lived S3 URL
- Telecaller sees own calls; manager sees team

## Database Considerations

- Store provider_call_id for webhook correlation
- transcript structured_data JSONB for extracted entities
- Index `(tenant_id, client_phone)`, `(tenant_id, started_at DESC)`
