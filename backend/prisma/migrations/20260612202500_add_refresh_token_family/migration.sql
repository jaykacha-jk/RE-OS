ALTER TABLE "refresh_tokens"
  ADD COLUMN "token_family_id" TEXT;

UPDATE "refresh_tokens"
SET "token_family_id" = "jti"
WHERE "token_family_id" IS NULL;

ALTER TABLE "refresh_tokens"
  ALTER COLUMN "token_family_id" SET NOT NULL;

CREATE INDEX "refresh_tokens_user_id_token_family_id_idx"
  ON "refresh_tokens"("user_id", "token_family_id");
