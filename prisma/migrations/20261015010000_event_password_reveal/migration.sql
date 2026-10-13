ALTER TABLE "Event" ADD COLUMN "draftPasswordEncrypted" TEXT;

ALTER TABLE "Event" ADD CONSTRAINT "Event_password_encryption_requires_hash"
  CHECK ("draftPasswordEncrypted" IS NULL OR "draftPasswordHash" IS NOT NULL);
