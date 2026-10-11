ALTER TABLE "user" ADD COLUMN "uiLocale" TEXT;
ALTER TABLE "user" ADD CONSTRAINT "user_uiLocale_check"
  CHECK ("uiLocale" IS NULL OR "uiLocale" IN ('en', 'de', 'pl', 'uk', 'ru'));
