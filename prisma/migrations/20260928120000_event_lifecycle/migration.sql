ALTER TABLE "Event"
  ADD COLUMN "cancelledAt" TIMESTAMPTZ(3),
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMPTZ(3);

ALTER TABLE "Event" ADD CONSTRAINT "Event_cancellation_reason_check" CHECK (
  ("cancelledAt" IS NULL AND "cancellationReason" IS NULL)
  OR ("cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL
      AND "cancellationReason" ~ '[^[:space:]]')
);

DROP INDEX "EventRevision_eventId_contentVersion_key";
ALTER TYPE "EmailOutboxType" ADD VALUE 'EVENT_CANCELLED';
