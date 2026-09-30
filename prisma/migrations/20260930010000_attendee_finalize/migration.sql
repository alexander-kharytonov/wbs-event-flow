-- Do not deploy before the Node AAD migration has committed successfully.
BEGIN;
LOCK TABLE "Registration", "Attendee", "Ticket", "Attendance" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Registration" r LEFT JOIN "Attendee" a ON a."registrationId" = r.id AND a.kind = 'PRIMARY'
    WHERE a.id IS NULL OR a."userId" IS DISTINCT FROM r."userId"
      OR a.name IS DISTINCT FROM r."attendeeName" OR a.email IS DISTINCT FROM r."attendeeEmail"
      OR a."createdAt" IS DISTINCT FROM r."createdAt" OR a."revokedAt" IS DISTINCT FROM r."revokedAt"
  ) OR EXISTS (SELECT 1 FROM "Attendee" WHERE kind <> 'PRIMARY')
  OR EXISTS (
    SELECT 1 FROM "Registration" r LEFT JOIN "Ticket" t ON t."registrationId" = r.id
    LEFT JOIN "Attendee" a ON a.id = t."attendeeId"
    WHERE t.id IS NULL OR a.id IS NULL OR a."registrationId" <> r.id
  ) OR EXISTS (
    SELECT 1 FROM "Attendance" h LEFT JOIN "Ticket" t ON t.id = h."ticketId"
    WHERE h."attendeeId" IS NULL OR h."attendeeId" IS DISTINCT FROM t."attendeeId"
      OR h."registrationId" IS DISTINCT FROM t."registrationId"
  ) THEN
    RAISE EXCEPTION 'Attendee data migration incomplete; run controlled Node migration before finalize';
  END IF;
END $$;
ALTER TABLE "Ticket" ALTER COLUMN "attendeeId" SET NOT NULL;
ALTER TABLE "Attendance" ALTER COLUMN "attendeeId" SET NOT NULL;
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_registrationId_ticketId_fkey";
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_registrationId_fkey";
DROP INDEX "Attendance_registrationId_key";
ALTER TABLE "Attendance" DROP COLUMN "registrationId";
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_registrationId_fkey";
DROP INDEX "Ticket_registrationId_key";
DROP INDEX "Ticket_registrationId_id_key";
ALTER TABLE "Ticket" DROP COLUMN "registrationId";
COMMIT;
