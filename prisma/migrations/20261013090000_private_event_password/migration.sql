ALTER TABLE "Event"
  ADD COLUMN "draftPasswordHash" TEXT,
  ADD COLUMN "passwordFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "passwordFailureWindow" TIMESTAMPTZ(3),
  ADD CONSTRAINT "Event_password_private" CHECK ("draftPasswordHash" IS NULL OR "visibility" = 'PRIVATE'),
  ADD CONSTRAINT "Event_password_failures" CHECK ("passwordFailures" BETWEEN 0 AND 100 AND ("passwordFailures" = 0 OR "passwordFailureWindow" IS NOT NULL));

ALTER TABLE "EventRevision"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "passwordGrantId" UUID,
  ADD CONSTRAINT "EventRevision_password_pair" CHECK (("passwordHash" IS NULL) = ("passwordGrantId" IS NULL)),
  ADD CONSTRAINT "EventRevision_password_private" CHECK ("passwordHash" IS NULL OR ("snapshot"->>'visibility') IS NOT DISTINCT FROM 'PRIVATE');
