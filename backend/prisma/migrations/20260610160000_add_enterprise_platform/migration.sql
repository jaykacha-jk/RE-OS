-- Phase 9: Enterprise + White Label Platform

-- Per-tenant settings (branding, seo, website, features, configuration, white_label)
CREATE TABLE IF NOT EXISTS "tenant_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "category" TEXT NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_settings_tenant_id_category_key"
  ON "tenant_settings"("tenant_id", "category");
CREATE INDEX IF NOT EXISTS "tenant_settings_tenant_id_idx"
  ON "tenant_settings"("tenant_id");

-- Custom domains (white-label hostnames + verification + SSL state)
CREATE TABLE IF NOT EXISTS "custom_domains" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "domain" TEXT NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "ssl_status" TEXT NOT NULL DEFAULT 'pending',
  "verification_status" TEXT NOT NULL DEFAULT 'pending',
  "verification_token" TEXT NOT NULL,
  "dns_records" JSONB NOT NULL DEFAULT '[]',
  "verified_at" TIMESTAMPTZ,
  "last_checked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS "custom_domains_domain_key" ON "custom_domains"("domain");
CREATE INDEX IF NOT EXISTS "custom_domains_tenant_id_idx" ON "custom_domains"("tenant_id");
CREATE INDEX IF NOT EXISTS "custom_domains_verification_status_idx" ON "custom_domains"("verification_status");
CREATE INDEX IF NOT EXISTS "custom_domains_deleted_at_idx" ON "custom_domains"("deleted_at");

-- Public website analytics events (views, clicks, conversions, traffic)
CREATE TABLE IF NOT EXISTS "public_analytics_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "event_type" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "path" TEXT,
  "referrer" TEXT,
  "source" TEXT,
  "session_id" TEXT,
  "user_agent" TEXT,
  "ip_hash" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "public_analytics_events_tenant_event_created_idx"
  ON "public_analytics_events"("tenant_id", "event_type", "created_at");
CREATE INDEX IF NOT EXISTS "public_analytics_events_tenant_created_idx"
  ON "public_analytics_events"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "public_analytics_events_tenant_path_idx"
  ON "public_analytics_events"("tenant_id", "path");
