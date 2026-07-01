import type { Conversation } from './chat';
import type { Inquiry } from './crm';

/** Minimal inquiry shape for CRM modals opened from the chat sidebar. */
export function inquiryStubFromConversation(conversation: Conversation): Inquiry | null {
  if (!conversation.inquiry) return null;

  return {
    id: conversation.inquiry.id,
    inquiry_code: conversation.inquiry.inquiry_code,
    client_name: conversation.client_name ?? 'Chat lead',
    phone: conversation.client_phone ?? '',
    email: conversation.client_email ?? null,
    whatsapp: null,
    stage: conversation.inquiry.stage,
    priority: 'medium',
    temperature: 'warm',
    lead_score: null,
    requirement_type: null,
    property_type: null,
    preferred_location: null,
    bedrooms: null,
    budget_min: null,
    budget_max: null,
    booking_amount: null,
    expected_commission: null,
    received_commission: null,
    commission_status: null,
    purchase_timeline: null,
    source_id: null,
    source_name: 'Live Chat',
    property_id: conversation.property_id,
    property: conversation.property
      ? {
          id: conversation.property.id,
          property_code: conversation.property.property_code,
          title: conversation.property.title,
        }
      : null,
    assigned_employee_id: conversation.assigned_employee_id,
    assigned_employee_name: conversation.assigned_employee_name,
    closed_at: null,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
  };
}
