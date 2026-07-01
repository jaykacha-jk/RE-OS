-- Denormalize tenant_id onto employees for indexed tenant-scoped queries.
ALTER TABLE "employees" ADD COLUMN "tenant_id" UUID;

UPDATE "employees" e
SET "tenant_id" = u."tenant_id"
FROM "users" u
WHERE e."user_id" = u."id";

ALTER TABLE "employees" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "employees_tenant_id_idx" ON "employees"("tenant_id");
CREATE INDEX "employees_tenant_id_status_idx" ON "employees"("tenant_id", "status");
