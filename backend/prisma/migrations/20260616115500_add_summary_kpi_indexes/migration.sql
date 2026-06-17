-- Summary KPI support indexes.
-- These keep CRM summary cards, stale-lead scans, and revenue collections
-- on tenant-scoped indexed paths instead of paginated-row derived metrics.
CREATE INDEX IF NOT EXISTS "inquiries_tenant_id_temperature_idx"
  ON "inquiries"("tenant_id", "temperature");

CREATE INDEX IF NOT EXISTS "inquiries_tenant_id_stage_created_at_idx"
  ON "inquiries"("tenant_id", "stage", "created_at");

CREATE INDEX IF NOT EXISTS "inquiries_tenant_id_assigned_employee_id_stage_idx"
  ON "inquiries"("tenant_id", "assigned_employee_id", "stage");

CREATE INDEX IF NOT EXISTS "inquiries_tenant_id_commission_status_idx"
  ON "inquiries"("tenant_id", "commission_status");
