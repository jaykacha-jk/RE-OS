CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "value_enc" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_settings_key_key" ON "platform_settings"("key");
CREATE INDEX IF NOT EXISTS "platform_settings_key_idx" ON "platform_settings"("key");

CREATE TABLE IF NOT EXISTS "platform_settings_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "settings_key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "value_enc" TEXT NOT NULL,
  "changed_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "platform_settings_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_settings_history_settings_key_version_idx"
  ON "platform_settings_history"("settings_key", "version");

ALTER TABLE "platform_settings_history"
  ADD CONSTRAINT "platform_settings_history_settings_key_fkey"
  FOREIGN KEY ("settings_key") REFERENCES "platform_settings"("key")
  ON DELETE CASCADE ON UPDATE CASCADE;
