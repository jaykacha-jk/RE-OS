# RE-OS AI Calling Agent Specification

**Version:** 1.0  
**AI Providers:** OpenAI (GPT-4o summary), Whisper (transcription)  
**Telephony:** Provider TBD (Exotel / Twilio India)

---

## 1. Objectives

| Goal | Metric |
|------|--------|
| Reduce qualification time | -50% time to first qualified note |
| Capture structured requirements | 80% calls produce valid budget + BHK |
| Improve conversion | +15% inquiry → site visit (target) |

---

## 2. Call Flow

```
Agent triggers call OR inbound received
    → Telephony provider connects
    → AI voice agent script (Hindi/English)
    → Recording to S3
    → Job: transcribe (Whisper)
    → Job: summarize + extract (GPT)
    → Update inquiry + lead_score
    → Notify assignee
```

---

## 3. Data Model

See `ai_calls`, `ai_call_transcripts` in [DB_SCHEMA.md](./DB_SCHEMA.md).

**Lead score (0–100):**

| Factor | Weight |
|--------|--------|
| Budget clarity | 25 |
| Timeline urgency | 25 |
| Requirement match | 25 |
| Engagement (duration, responses) | 25 |

---

## 4. GPT Extraction Schema

```json
{
  "budget_min": 8000000,
  "budget_max": 10000000,
  "bhk": 3,
  "locations": ["SG Highway", "Bopal"],
  "timeline_months": 6,
  "intent": "buy",
  "interest_level": "high",
  "summary": "Buyer looking for 3BHK...",
  "confidence": 0.92
}
```

Apply to inquiry only if `confidence >= 0.8` (BR-AI04).

---

## 5. Compliance (India)

- Opening script: recording disclosure  
- `consent_recorded` required for outbound  
- DND registry check API before dial  
- Store opt-out flag on inquiry  

---

## 6. API Summary

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/ai/calls` | Initiate outbound |
| GET | `/ai/calls` | List calls |
| GET | `/ai/calls/:id` | Detail |
| GET | `/ai/calls/:id/transcript` | Full transcript |

---

## 7. Quotas

- Pro: 500 minutes/month  
- Overage: ₹5/minute or block (config)  
- Track in `organization_usage.ai_minutes_used`  

---

## 8. Failure Handling

| Failure | Behavior |
|---------|----------|
| No answer | status=failed; retry max 2 |
| Transcription fail | retry 3x; alert ops |
| Low confidence extract | summary only; no auto-fill |

---

*Security: [SECURITY.md](./SECURITY.md). Phase: [MVP_ROADMAP.md](./MVP_ROADMAP.md) Phase 8.*
