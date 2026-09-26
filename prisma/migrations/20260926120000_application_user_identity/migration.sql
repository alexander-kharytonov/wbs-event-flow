-- Existing anonymous applications retain a NULL identity link.
ALTER TABLE "Application" ADD COLUMN "userId" TEXT;

-- PostgreSQL permits multiple NULL values for anonymous applicants.
CREATE UNIQUE INDEX "Application_eventId_userId_key" ON "Application"("eventId", "userId");

ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
