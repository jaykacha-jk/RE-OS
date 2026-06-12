-- Phase 7: Billing + Subscription Platform

ALTER TABLE "subscription_plans"
  ADD COLUMN IF NOT EXISTS "storage_limit_bytes" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "plan_id" UUID NOT NULL REFERENCES "subscription_plans"("id"),
  "status" TEXT NOT NULL DEFAULT 'trial',
  "billing_cycle" TEXT NOT NULL DEFAULT 'monthly',
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "provider_subscription_id" TEXT UNIQUE,
  "provider_customer_id" TEXT,
  "current_period_start" TIMESTAMPTZ,
  "current_period_end" TIMESTAMPTZ,
  "trial_ends_at" TIMESTAMPTZ,
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "cancelled_at" TIMESTAMPTZ,
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");
CREATE INDEX IF NOT EXISTS "subscriptions_tenant_id_status_idx" ON "subscriptions"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE INDEX IF NOT EXISTS "subscriptions_deleted_at_idx" ON "subscriptions"("deleted_at");

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "subscription_id" UUID NOT NULL REFERENCES "subscriptions"("id"),
  "plan_id" UUID NOT NULL REFERENCES "subscription_plans"("id"),
  "invoice_number" TEXT NOT NULL,
  "subtotal" INTEGER NOT NULL,
  "tax" INTEGER NOT NULL DEFAULT 0,
  "discount" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "pdf_url" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "provider_invoice_id" TEXT UNIQUE,
  "issued_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "due_at" TIMESTAMPTZ,
  "paid_at" TIMESTAMPTZ,
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ,
  CONSTRAINT "invoices_tenant_invoice_number_key" UNIQUE ("tenant_id", "invoice_number")
);

CREATE INDEX IF NOT EXISTS "invoices_tenant_id_idx" ON "invoices"("tenant_id");
CREATE INDEX IF NOT EXISTS "invoices_tenant_id_status_idx" ON "invoices"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "invoices_subscription_id_idx" ON "invoices"("subscription_id");
CREATE INDEX IF NOT EXISTS "invoices_deleted_at_idx" ON "invoices"("deleted_at");

CREATE TABLE IF NOT EXISTS "payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "subscription_id" UUID NOT NULL REFERENCES "subscriptions"("id"),
  "invoice_id" UUID REFERENCES "invoices"("id"),
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "provider_payment_id" TEXT UNIQUE,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'created',
  "method" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "paid_at" TIMESTAMPTZ,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "payments_tenant_id_idx" ON "payments"("tenant_id");
CREATE INDEX IF NOT EXISTS "payments_subscription_id_idx" ON "payments"("subscription_id");
CREATE INDEX IF NOT EXISTS "payments_invoice_id_idx" ON "payments"("invoice_id");
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments"("status");
CREATE INDEX IF NOT EXISTS "payments_deleted_at_idx" ON "payments"("deleted_at");

CREATE TABLE IF NOT EXISTS "payment_attempts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "subscription_id" UUID NOT NULL REFERENCES "subscriptions"("id"),
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "provider_payment_id" TEXT,
  "provider_subscription_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'created',
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "error_code" TEXT,
  "error_message" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "attempted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payment_attempts_tenant_id_idx" ON "payment_attempts"("tenant_id");
CREATE INDEX IF NOT EXISTS "payment_attempts_subscription_id_idx" ON "payment_attempts"("subscription_id");
CREATE INDEX IF NOT EXISTS "payment_attempts_status_idx" ON "payment_attempts"("status");

CREATE TABLE IF NOT EXISTS "coupons" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID REFERENCES "organizations"("id"),
  "code" TEXT NOT NULL,
  "discount_type" TEXT NOT NULL,
  "discount_value" INTEGER NOT NULL,
  "max_redemptions" INTEGER,
  "redeemed_count" INTEGER NOT NULL DEFAULT 0,
  "starts_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ,
  CONSTRAINT "coupons_tenant_code_key" UNIQUE ("tenant_id", "code")
);

CREATE INDEX IF NOT EXISTS "coupons_tenant_id_idx" ON "coupons"("tenant_id");
CREATE INDEX IF NOT EXISTS "coupons_code_idx" ON "coupons"("code");
CREATE INDEX IF NOT EXISTS "coupons_deleted_at_idx" ON "coupons"("deleted_at");

CREATE TABLE IF NOT EXISTS "usage_metrics" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "metric_key" TEXT NOT NULL,
  "metric_value" BIGINT NOT NULL DEFAULT 0,
  "period_start" TIMESTAMPTZ NOT NULL,
  "period_end" TIMESTAMPTZ NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "usage_metrics_tenant_metric_period_key" UNIQUE ("tenant_id", "metric_key", "period_start")
);

CREATE INDEX IF NOT EXISTS "usage_metrics_tenant_id_idx" ON "usage_metrics"("tenant_id");
CREATE INDEX IF NOT EXISTS "usage_metrics_metric_key_idx" ON "usage_metrics"("metric_key");

CREATE TABLE IF NOT EXISTS "billing_webhook_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL DEFAULT 'razorpay',
  "provider_event_id" TEXT NOT NULL UNIQUE,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "signature_valid" BOOLEAN NOT NULL DEFAULT false,
  "processed_at" TIMESTAMPTZ,
  "processing_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "billing_webhook_events_provider_event_type_idx" ON "billing_webhook_events"("provider", "event_type");
CREATE INDEX IF NOT EXISTS "billing_webhook_events_processed_at_idx" ON "billing_webhook_events"("processed_at");
