-- Phase 3 — CRM / Inquiry Pipeline domain
-- Tables: lead_sources, inquiries, inquiry_notes, inquiry_activities,
--         inquiry_followups, inquiry_assignments, inquiry_history, site_visits

-- CreateTable
CREATE TABLE "lead_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "inquiry_code" TEXT NOT NULL,
    "property_id" UUID,
    "assigned_employee_id" UUID,
    "source_id" UUID,
    "source_name" TEXT,
    "client_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "whatsapp" TEXT,
    "budget_min" DECIMAL(14,2),
    "budget_max" DECIMAL(14,2),
    "requirement_type" TEXT,
    "preferred_location" TEXT,
    "property_type" TEXT,
    "bedrooms" INTEGER,
    "purchase_timeline" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "temperature" TEXT NOT NULL DEFAULT 'warm',
    "lead_score" INTEGER,
    "no_property_reason" TEXT,
    "lost_reason" TEXT,
    "closed_at" TIMESTAMP(3),
    "remarks" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "created_by" UUID,
    "created_by_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "activity_type" TEXT NOT NULL,
    "content" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "actor_id" UUID,
    "actor_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_followups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "assigned_employee_id" UUID,
    "followup_date" DATE NOT NULL,
    "followup_time" TEXT,
    "followup_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_followups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "change_type" TEXT NOT NULL,
    "changed_fields" JSONB NOT NULL DEFAULT '{}',
    "changed_by" UUID,
    "changed_by_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_visits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "property_id" UUID,
    "employee_id" UUID,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_sources_tenant_id_idx" ON "lead_sources"("tenant_id");
CREATE UNIQUE INDEX "lead_sources_tenant_id_name_key" ON "lead_sources"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "inquiries_tenant_id_idx" ON "inquiries"("tenant_id");
CREATE INDEX "inquiries_tenant_id_stage_idx" ON "inquiries"("tenant_id", "stage");
CREATE INDEX "inquiries_tenant_id_assigned_employee_id_idx" ON "inquiries"("tenant_id", "assigned_employee_id");
CREATE INDEX "inquiries_tenant_id_source_id_idx" ON "inquiries"("tenant_id", "source_id");
CREATE INDEX "inquiries_tenant_id_created_at_idx" ON "inquiries"("tenant_id", "created_at");
CREATE INDEX "inquiries_tenant_id_phone_idx" ON "inquiries"("tenant_id", "phone");
CREATE INDEX "inquiries_tenant_id_email_idx" ON "inquiries"("tenant_id", "email");
CREATE INDEX "inquiries_deleted_at_idx" ON "inquiries"("deleted_at");
CREATE UNIQUE INDEX "inquiries_tenant_id_inquiry_code_key" ON "inquiries"("tenant_id", "inquiry_code");

-- CreateIndex
CREATE INDEX "inquiry_notes_inquiry_id_created_at_idx" ON "inquiry_notes"("inquiry_id", "created_at");
CREATE INDEX "inquiry_notes_tenant_id_idx" ON "inquiry_notes"("tenant_id");

-- CreateIndex
CREATE INDEX "inquiry_activities_inquiry_id_created_at_idx" ON "inquiry_activities"("inquiry_id", "created_at");
CREATE INDEX "inquiry_activities_tenant_id_idx" ON "inquiry_activities"("tenant_id");

-- CreateIndex
CREATE INDEX "inquiry_followups_inquiry_id_idx" ON "inquiry_followups"("inquiry_id");
CREATE INDEX "inquiry_followups_tenant_id_followup_date_idx" ON "inquiry_followups"("tenant_id", "followup_date");
CREATE INDEX "inquiry_followups_tenant_id_status_idx" ON "inquiry_followups"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "inquiry_assignments_inquiry_id_idx" ON "inquiry_assignments"("inquiry_id");
CREATE INDEX "inquiry_assignments_tenant_id_idx" ON "inquiry_assignments"("tenant_id");
CREATE INDEX "inquiry_assignments_employee_id_idx" ON "inquiry_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "inquiry_history_inquiry_id_created_at_idx" ON "inquiry_history"("inquiry_id", "created_at");
CREATE INDEX "inquiry_history_tenant_id_idx" ON "inquiry_history"("tenant_id");

-- CreateIndex
CREATE INDEX "site_visits_inquiry_id_idx" ON "site_visits"("inquiry_id");
CREATE INDEX "site_visits_tenant_id_scheduled_at_idx" ON "site_visits"("tenant_id", "scheduled_at");
CREATE INDEX "site_visits_tenant_id_status_idx" ON "site_visits"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_notes" ADD CONSTRAINT "inquiry_notes_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_activities" ADD CONSTRAINT "inquiry_activities_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_followups" ADD CONSTRAINT "inquiry_followups_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inquiry_followups" ADD CONSTRAINT "inquiry_followups_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_assignments" ADD CONSTRAINT "inquiry_assignments_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inquiry_assignments" ADD CONSTRAINT "inquiry_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_history" ADD CONSTRAINT "inquiry_history_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
