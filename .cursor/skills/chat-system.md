# Chat System — Agent Skill

## Domain Knowledge

Live chat connects website visitors (clients) with tenant agents. Conversations may link to properties and inquiries. Channels: website widget (Phase 6), WhatsApp (later).

## Business Workflow

1. Client opens widget on property page (context: property_id)
2. Conversation created status=open, unassigned
3. After 5 min → auto-assign available agent round-robin
4. Agent responds via inbox; messages realtime via Socket.io
5. Optional: create/link inquiry from captured phone
6. Close conversation; reopen on new client message

## Entity Relationships

```
chat_conversations 1──* chat_messages
chat_conversations *──1 properties (optional)
chat_conversations *──1 inquiries (optional)
chat_conversations *──1 employees (assigned)
users (client) *──* chat_conversations
```

## Validation Rules

- BR-CH01 tenant boundary on all rows
- BR-CH02 auto-assign 5 min
- BR-CH03 reopen on new message
- BR-CH04 agent scope on read
- Message body max 4000 chars; sanitize HTML

## Common Edge Cases

- Anonymous client later identifies with phone → merge session
- Multiple tabs same client → same conversation id in localStorage
- Agent offline → queue messages; notify on assignment
- WhatsApp external id mapping (Phase 6+)

## API Considerations

- REST for history; WebSocket for live messages
- JWT handshake must match conversation tenant_id
- Rate limit client message sends anti-spam

## Database Considerations

- Index `(tenant_id, status, last_message_at DESC)` for inbox
- Index `(conversation_id, created_at)` for message pagination
- Soft delete not typical for messages — retention policy 1 year
