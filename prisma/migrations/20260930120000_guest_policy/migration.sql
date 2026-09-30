ALTER TABLE "Event" ADD COLUMN "maxGuestsPerRegistration" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Event" ADD CONSTRAINT "Event_guest_limit_check" CHECK ("maxGuestsPerRegistration" BETWEEN 0 AND 10);
