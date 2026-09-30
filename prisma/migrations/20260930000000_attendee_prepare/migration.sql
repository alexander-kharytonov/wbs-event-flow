-- Controlled cutover: stop all writers, old consumers and email dispatchers.
-- Apply this preparation separately, then scripts/migrate-attendees.ts, then finalize.
BEGIN;
CREATE TYPE "AttendeeKind" AS ENUM ('PRIMARY', 'GUEST');
CREATE TABLE "Attendee" (
  "id" UUID NOT NULL,
  "registrationId" UUID NOT NULL,
  "kind" "AttendeeKind" NOT NULL,
  "userId" UUID,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMPTZ(3),
  CONSTRAINT "Attendee_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Attendee_revocation_time_check" CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt"),
  CONSTRAINT "Attendee_guest_user_check" CHECK (kind <> 'GUEST' OR "userId" IS NULL),
  CONSTRAINT "Attendee_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Attendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Attendee_primary_key" ON "Attendee"("registrationId") WHERE (kind = 'PRIMARY'::"AttendeeKind");
CREATE INDEX "Attendee_registrationId_revokedAt_idx" ON "Attendee"("registrationId", "revokedAt");
ALTER TABLE "Ticket" ADD COLUMN "attendeeId" UUID;
ALTER TABLE "Attendance" ADD COLUMN "attendeeId" UUID;
CREATE UNIQUE INDEX "Ticket_attendeeId_key" ON "Ticket"("attendeeId");
CREATE UNIQUE INDEX "Ticket_attendeeId_id_key" ON "Ticket"("attendeeId", id);
CREATE UNIQUE INDEX "Attendance_attendeeId_key" ON "Attendance"("attendeeId");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_attendeeId_ticketId_fkey" FOREIGN KEY ("attendeeId", "ticketId") REFERENCES "Ticket"("attendeeId", id) ON DELETE RESTRICT ON UPDATE RESTRICT;
COMMIT;
