CREATE TYPE "DescriptionFormat" AS ENUM ('PLAIN_TEXT', 'MARKDOWN');
CREATE TYPE "MediaAssetState" AS ENUM ('UPLOADING', 'READY', 'DELETING');

ALTER TABLE "Event"
  ADD COLUMN "coverAlt" TEXT,
  ADD COLUMN "coverAssetId" UUID,
  ADD COLUMN "descriptionFormat" "DescriptionFormat" NOT NULL DEFAULT 'PLAIN_TEXT',
  ADD COLUMN "location" JSONB,
  ADD COLUMN "publicOrganizer" JSONB,
  ADD COLUMN "schedule" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "EventRevision" ADD COLUMN "coverAssetId" UUID;

CREATE TABLE "MediaAsset" (
  "id" UUID NOT NULL,
  "organizerId" UUID NOT NULL,
  "eventId" UUID,
  "backend" TEXT NOT NULL DEFAULT 'LOCAL',
  "storageKey" TEXT NOT NULL,
  "state" "MediaAssetState" NOT NULL DEFAULT 'UPLOADING',
  "manifest" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploadExpiresAt" TIMESTAMPTZ(3) NOT NULL,
  "readyAt" TIMESTAMPTZ(3),
  "unusedSince" TIMESTAMPTZ(3),
  "deletingAt" TIMESTAMPTZ(3),
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaAsset_locator_check" CHECK (
    "backend" = 'LOCAL' AND "storageKey" ~ '^[a-f0-9]{32}$'
  ),
  CONSTRAINT "MediaAsset_state_check" CHECK (
    ("state" = 'UPLOADING' AND "manifest" IS NULL AND "readyAt" IS NULL AND "deletingAt" IS NULL)
    OR ("state" = 'READY' AND "manifest" IS NOT NULL AND "readyAt" IS NOT NULL AND "deletingAt" IS NULL)
    OR ("state" = 'DELETING' AND "deletingAt" IS NOT NULL)
  ),
  CONSTRAINT "MediaAsset_manifest_check" CHECK (
    "manifest" IS NULL OR (
      jsonb_typeof("manifest") = 'object'
      AND "manifest" ?& ARRAY['640', '1280', '1920', 'social']
      AND "manifest" - ARRAY['640', '1280', '1920', 'social'] = '{}'::jsonb
      AND jsonb_typeof("manifest"->'640') = 'object'
      AND jsonb_typeof("manifest"->'1280') = 'object'
      AND jsonb_typeof("manifest"->'1920') = 'object'
      AND jsonb_typeof("manifest"->'social') = 'object'
    )
  ),
  CONSTRAINT "MediaAsset_timestamps_check" CHECK (
    "uploadExpiresAt" > "createdAt"
    AND ("readyAt" IS NULL OR "readyAt" >= "createdAt")
    AND ("unusedSince" IS NULL OR "unusedSince" >= "createdAt")
    AND ("deletingAt" IS NULL OR "deletingAt" >= "createdAt")
  )
);

CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");
CREATE INDEX "MediaAsset_organizerId_state_idx" ON "MediaAsset"("organizerId", "state");
CREATE INDEX "MediaAsset_eventId_idx" ON "MediaAsset"("eventId");
CREATE INDEX "MediaAsset_state_uploadExpiresAt_idx" ON "MediaAsset"("state", "uploadExpiresAt");
CREATE INDEX "MediaAsset_state_unusedSince_idx" ON "MediaAsset"("state", "unusedSince");
CREATE INDEX "Event_coverAssetId_idx" ON "Event"("coverAssetId");
CREATE INDEX "EventRevision_coverAssetId_idx" ON "EventRevision"("coverAssetId");

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "OrganizerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventRevision" ADD CONSTRAINT "EventRevision_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Event" ADD CONSTRAINT "Event_cover_alt_check" CHECK (
  ("coverAlt" IS NULL OR char_length("coverAlt") <= 500)
  AND ("coverAssetId" IS NOT NULL OR "coverAlt" IS NULL)
);
ALTER TABLE "Event" ADD CONSTRAINT "Event_rich_content_shape_check" CHECK (
  jsonb_typeof("schedule") = 'array' AND jsonb_array_length("schedule") <= 100
  AND ("location" IS NULL OR jsonb_typeof("location") = 'object')
  AND ("publicOrganizer" IS NULL OR jsonb_typeof("publicOrganizer") = 'object')
);
