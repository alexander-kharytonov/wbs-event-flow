-- CreateEnum
CREATE TYPE "CommunicationKind" AS ENUM ('MANUAL', 'TRANSACTIONAL');

-- CreateEnum
CREATE TYPE "CommunicationTrigger" AS ENUM ('EVENT_CANCELLED', 'APPLICATION_RECEIVED', 'NEW_APPLICATION', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED');

-- CreateEnum
CREATE TYPE "CommunicationAudience" AS ENUM ('ALL_ACTIVE_ATTENDEES', 'PRIMARY_ATTENDEES', 'CHECKED_IN', 'NOT_ARRIVED', 'PENDING_APPLICATIONS', 'EVENT_STAFF');

-- CreateEnum
CREATE TYPE "CommunicationActorRole" AS ENUM ('OWNER', 'MANAGER', 'RECEPTION');

-- AlterEnum
ALTER TYPE "EmailOutboxType" ADD VALUE 'MANUAL_EVENT_MESSAGE';

-- AlterTable
ALTER TABLE "EmailOutbox" ADD COLUMN     "communicationId" UUID;

-- CreateTable
CREATE TABLE "Communication" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "kind" "CommunicationKind" NOT NULL,
    "trigger" "CommunicationTrigger",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" UUID,
    "actorNameSnapshot" TEXT,
    "actorRoleSnapshot" "CommunicationActorRole",
    "audience" "CommunicationAudience",
    "subject" TEXT NOT NULL,
    "message" TEXT,
    "contextSnapshot" JSONB NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestDigest" TEXT,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Communication_eventId_createdAt_id_idx" ON "Communication"("eventId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Communication_eventId_kind_createdAt_idx" ON "Communication"("eventId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "Communication_actorUserId_kind_createdAt_idx" ON "Communication"("actorUserId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Communication_eventId_idempotencyKey_key" ON "Communication"("eventId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailOutbox_communicationId_status_id_idx" ON "EmailOutbox"("communicationId", "status", "id");

-- CreateIndex
CREATE INDEX "EmailOutbox_type_status_communicationId_idx" ON "EmailOutbox"("type", "status", "communicationId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_communicationId_recipientEmail_key" ON "EmailOutbox"("communicationId", "recipientEmail");

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Immutable content is application-owned, matching EventRevision. Structural
-- invariants are also enforced here; no legacy row needs a backfill.
ALTER TABLE "Communication"
  ADD CONSTRAINT "Communication_recipientCount_check" CHECK ("recipientCount" >= 0),
  ADD CONSTRAINT "Communication_subject_check" CHECK (char_length("subject") BETWEEN 1 AND 200),
  ADD CONSTRAINT "Communication_idempotencyKey_check" CHECK (
    char_length("idempotencyKey") BETWEEN 1 AND 200 AND "idempotencyKey" ~ '^[A-Za-z0-9:._-]+$'
  ),
  ADD CONSTRAINT "Communication_requestDigest_check" CHECK (
    "requestDigest" IS NULL OR "requestDigest" ~ '^[a-f0-9]{64}$'
  ),
  ADD CONSTRAINT "Communication_kind_content_check" CHECK (
    ("kind" = 'MANUAL' AND "trigger" IS NULL AND "audience" IS NOT NULL
      AND "message" IS NOT NULL AND char_length("message") BETWEEN 1 AND 10000
      AND "requestDigest" IS NOT NULL AND "actorNameSnapshot" IS NOT NULL
      AND "actorRoleSnapshot" IS NOT NULL AND "actorRoleSnapshot" IN ('OWNER', 'MANAGER'))
    OR ("kind" = 'TRANSACTIONAL' AND "trigger" IS NOT NULL AND "audience" IS NULL AND "message" IS NULL)
  ),
  ADD CONSTRAINT "Communication_actor_snapshot_check" CHECK (
    ("actorNameSnapshot" IS NULL) = ("actorRoleSnapshot" IS NULL)
    AND ("actorUserId" IS NULL OR "actorNameSnapshot" IS NOT NULL)
    AND ("actorNameSnapshot" IS NULL OR char_length("actorNameSnapshot") > 0)
  ),
  ADD CONSTRAINT "Communication_context_object_check" CHECK (
    jsonb_typeof("contextSnapshot") = 'object'
  );

ALTER TABLE "EmailOutbox"
  ADD CONSTRAINT "EmailOutbox_manual_communication_check" CHECK (
    "type"::text <> 'MANUAL_EVENT_MESSAGE' OR "communicationId" IS NOT NULL
  ),
  ADD CONSTRAINT "EmailOutbox_communication_email_check" CHECK (
    "communicationId" IS NULL OR "recipientEmail" = lower(btrim("recipientEmail"))
  );
