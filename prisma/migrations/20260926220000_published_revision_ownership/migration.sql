BEGIN;

ALTER TABLE "Event" DROP CONSTRAINT "Event_publishedRevisionId_fkey";

-- Prisma's one-to-one composite relation requires this candidate key.
CREATE UNIQUE INDEX "Event_id_publishedRevisionId_key"
ON "Event"("id", "publishedRevisionId");

-- A NULL pointer still permits creating an unpublished Event first.
-- RESTRICT avoids SET NULL or CASCADE rewriting the Event's own primary key.
ALTER TABLE "Event" ADD CONSTRAINT "Event_id_publishedRevisionId_fkey"
FOREIGN KEY ("id", "publishedRevisionId")
REFERENCES "EventRevision"("eventId", "id")
ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMIT;
