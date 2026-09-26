-- Preserve submitted applications and answers as separate attempts.
ALTER TYPE "ApplicationStatus" ADD VALUE 'WITHDRAWN';
ALTER TABLE "Application" ADD COLUMN "withdrawnAt" TIMESTAMPTZ(3);

-- Rejected applications still block another attempt. Only withdrawal releases
-- identity uniqueness; approved capacity continues to count APPROVED only.
DROP INDEX "Application_eventId_email_key";
DROP INDEX "Application_eventId_userId_key";
CREATE UNIQUE INDEX "Application_eventId_email_key"
ON "Application"("eventId", "email")
WHERE "status" IN ('PENDING', 'APPROVED', 'REJECTED');
CREATE UNIQUE INDEX "Application_eventId_userId_key"
ON "Application"("eventId", "userId")
WHERE "status" IN ('PENDING', 'APPROVED', 'REJECTED');
CREATE INDEX "Application_eventId_userId_createdAt_idx"
ON "Application"("eventId", "userId", "createdAt");
