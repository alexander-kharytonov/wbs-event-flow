CREATE TYPE "StaffRole" AS ENUM ('MANAGER', 'RECEPTION');
CREATE TABLE "EventStaff" (
  "eventId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "StaffRole" NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "EventStaff_pkey" PRIMARY KEY ("eventId", "userId"),
  CONSTRAINT "EventStaff_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EventStaff_userId_idx" ON "EventStaff"("userId");
ALTER TABLE "Application" ADD COLUMN "reviewedByUserId" UUID;
ALTER TABLE "Application" ADD CONSTRAINT "Application_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
