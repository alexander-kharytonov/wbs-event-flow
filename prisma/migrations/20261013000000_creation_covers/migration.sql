ALTER TABLE "MediaAsset" ADD COLUMN "temporaryExpiresAt" TIMESTAMPTZ(3);
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_temporary_check" CHECK (
  "temporaryExpiresAt" IS NULL OR (
    "eventId" IS NULL AND "temporaryExpiresAt" = "uploadExpiresAt"
  )
);
CREATE INDEX "MediaAsset_temporaryExpiresAt_idx" ON "MediaAsset"("temporaryExpiresAt");

CREATE TABLE "EventCreationReceipt" (
  "key" UUID NOT NULL PRIMARY KEY,
  "organizerId" UUID NOT NULL REFERENCES "OrganizerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "eventId" UUID REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "result" JSONB NOT NULL,
  "fingerprint" TEXT NOT NULL CHECK ("fingerprint" ~ '^[a-f0-9]{64}$'),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventCreationReceipt_result_check" CHECK (jsonb_typeof("result") = 'object')
);
CREATE UNIQUE INDEX "EventCreationReceipt_eventId_key" ON "EventCreationReceipt"("eventId");
CREATE INDEX "EventCreationReceipt_organizerId_idx" ON "EventCreationReceipt"("organizerId");
