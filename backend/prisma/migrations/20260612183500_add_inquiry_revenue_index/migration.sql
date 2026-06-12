CREATE INDEX "inquiries_tenant_id_stage_closed_at_idx"
ON "inquiries"("tenant_id", "stage", "closed_at");
