ALTER TABLE "user" ADD COLUMN "uiMode" TEXT;
ALTER TABLE "user" ADD CONSTRAINT "user_uiMode_check"
  CHECK ("uiMode" IS NULL OR "uiMode" IN ('light', 'dark', 'system'));
