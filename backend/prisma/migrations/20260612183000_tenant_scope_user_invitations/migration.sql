ALTER TABLE "user_invitations"
ADD COLUMN "tenant_id" UUID,
ADD COLUMN "user_id" UUID;

UPDATE "user_invitations" ui
SET
  "tenant_id" = matched."tenant_id",
  "user_id" = matched."user_id"
FROM (
  SELECT DISTINCT ON (ui_inner."id")
    ui_inner."id" AS "invitation_id",
    u."tenant_id",
    u."id" AS "user_id"
  FROM "user_invitations" ui_inner
  JOIN "user_roles" ur ON ur."role_id" = ui_inner."role_id"
  JOIN "users" u ON u."id" = ur."user_id"
  WHERE u."email" = ui_inner."email"
    AND u."status" = 'invited'
    AND u."deleted_at" IS NULL
    AND u."tenant_id" IS NOT NULL
  ORDER BY ui_inner."id", u."created_at" DESC
) matched
WHERE ui."id" = matched."invitation_id";

DELETE FROM "user_invitations"
WHERE "tenant_id" IS NULL OR "user_id" IS NULL;

ALTER TABLE "user_invitations"
ALTER COLUMN "tenant_id" SET NOT NULL,
ALTER COLUMN "user_id" SET NOT NULL;

ALTER TABLE "user_invitations"
ADD CONSTRAINT "user_invitations_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_invitations"
ADD CONSTRAINT "user_invitations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "user_invitations_tenant_id_idx" ON "user_invitations"("tenant_id");
CREATE INDEX "user_invitations_user_id_idx" ON "user_invitations"("user_id");
