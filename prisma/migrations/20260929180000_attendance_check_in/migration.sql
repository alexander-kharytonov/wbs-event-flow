-- Presence cannot be inferred from admission: deliberately no backfill.
CREATE TYPE "AttendanceMethod" AS ENUM ('QR');

CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "ticketId" UUID,
    "checkedInAt" TIMESTAMPTZ(3) NOT NULL,
    "checkedInByUserId" UUID,
    "method" "AttendanceMethod" NOT NULL,
    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Attendance_qr_ticket_check" CHECK ("method" <> 'QR' OR "ticketId" IS NOT NULL)
);

CREATE UNIQUE INDEX "Attendance_registrationId_key" ON "Attendance"("registrationId");
CREATE UNIQUE INDEX "Ticket_registrationId_id_key" ON "Ticket"("registrationId", "id");

ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_registrationId_ticketId_fkey"
    FOREIGN KEY ("registrationId", "ticketId") REFERENCES "Ticket"("registrationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_checkedInByUserId_fkey"
    FOREIGN KEY ("checkedInByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
