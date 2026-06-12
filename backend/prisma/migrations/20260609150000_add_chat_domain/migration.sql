-- Phase 6 — Live Chat & Omnichannel Foundation
-- Tables: conversations, conversation_participants, messages, message_attachments,
--         conversation_assignments, conversation_activities, conversation_tags
-- type:           website | inquiry | property | support | internal
-- status:         open | assigned | waiting | closed | archived
-- message_type:   text | image | file | system
-- message status: sent | delivered | read | failed
-- sender/participant_type: employee | client | system

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "conversation_code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'website',
    "status" TEXT NOT NULL DEFAULT 'open',
    "subject" TEXT,
    "property_id" UUID,
    "property_slug" TEXT,
    "inquiry_id" UUID,
    "client_name" TEXT,
    "client_email" TEXT,
    "client_phone" TEXT,
    "client_identifier" TEXT,
    "assigned_employee_id" UUID,
    "last_message_at" TIMESTAMP(3),
    "last_message_preview" TEXT,
    "created_by" UUID,
    "closed_at" TIMESTAMP(3),
    "closed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "participant_type" TEXT NOT NULL DEFAULT 'employee',
    "user_id" UUID,
    "employee_id" UUID,
    "display_name" TEXT,
    "last_read_at" TIMESTAMP(3),
    "last_read_message_id" UUID,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_type" TEXT NOT NULL DEFAULT 'client',
    "sender_id" UUID,
    "sender_name" TEXT,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "storage_key" TEXT,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content_type" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'file',
    "size_bytes" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "activity_type" TEXT NOT NULL,
    "content" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "actor_id" UUID,
    "actor_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_tenant_id_conversation_code_key" ON "conversations"("tenant_id", "conversation_code");
CREATE INDEX "conversations_tenant_id_idx" ON "conversations"("tenant_id");
CREATE INDEX "conversations_tenant_id_status_idx" ON "conversations"("tenant_id", "status");
CREATE INDEX "conversations_tenant_id_assigned_employee_id_idx" ON "conversations"("tenant_id", "assigned_employee_id");
CREATE INDEX "conversations_tenant_id_type_idx" ON "conversations"("tenant_id", "type");
CREATE INDEX "conversations_tenant_id_last_message_at_idx" ON "conversations"("tenant_id", "last_message_at");
CREATE INDEX "conversations_property_id_idx" ON "conversations"("property_id");
CREATE INDEX "conversations_inquiry_id_idx" ON "conversations"("inquiry_id");
CREATE INDEX "conversations_deleted_at_idx" ON "conversations"("deleted_at");

CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");
CREATE INDEX "conversation_participants_conversation_id_idx" ON "conversation_participants"("conversation_id");
CREATE INDEX "conversation_participants_tenant_id_idx" ON "conversation_participants"("tenant_id");
CREATE INDEX "conversation_participants_user_id_idx" ON "conversation_participants"("user_id");

CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
CREATE INDEX "messages_tenant_id_idx" ON "messages"("tenant_id");
CREATE INDEX "messages_conversation_id_status_idx" ON "messages"("conversation_id", "status");
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");
CREATE INDEX "messages_deleted_at_idx" ON "messages"("deleted_at");

CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");
CREATE INDEX "message_attachments_tenant_id_idx" ON "message_attachments"("tenant_id");

CREATE INDEX "conversation_assignments_conversation_id_idx" ON "conversation_assignments"("conversation_id");
CREATE INDEX "conversation_assignments_tenant_id_idx" ON "conversation_assignments"("tenant_id");
CREATE INDEX "conversation_assignments_employee_id_idx" ON "conversation_assignments"("employee_id");

CREATE INDEX "conversation_activities_conversation_id_created_at_idx" ON "conversation_activities"("conversation_id", "created_at");
CREATE INDEX "conversation_activities_tenant_id_idx" ON "conversation_activities"("tenant_id");

CREATE UNIQUE INDEX "conversation_tags_conversation_id_tag_key" ON "conversation_tags"("conversation_id", "tag");
CREATE INDEX "conversation_tags_conversation_id_idx" ON "conversation_tags"("conversation_id");
CREATE INDEX "conversation_tags_tenant_id_idx" ON "conversation_tags"("tenant_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_assignments" ADD CONSTRAINT "conversation_assignments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_assignments" ADD CONSTRAINT "conversation_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_activities" ADD CONSTRAINT "conversation_activities_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
