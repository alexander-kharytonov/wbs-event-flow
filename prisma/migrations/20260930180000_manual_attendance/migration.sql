ALTER TYPE "AttendanceMethod" ADD VALUE 'MANUAL';

-- Use text comparisons so the new enum value need not be used before commit.
-- Validate existing history; never rewrite it.
ALTER TABLE "Attendance"
  DROP CONSTRAINT "Attendance_qr_ticket_check",
  ADD CONSTRAINT "Attendance_method_ticket_check" CHECK (
    ("method"::text = 'QR' AND "ticketId" IS NOT NULL)
    OR ("method"::text = 'MANUAL' AND "ticketId" IS NULL)
  );
