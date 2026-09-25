-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "EventAccountRequirement" AS ENUM ('REQUIRED', 'OPTIONAL');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "visibility" "EventVisibility" NOT NULL DEFAULT 'PRIVATE',
    "accountRequirement" "EventAccountRequirement" NOT NULL DEFAULT 'OPTIONAL',
    "capacity" INTEGER,
    "registrationOpensAt" TIMESTAMPTZ(3),
    "registrationClosesAt" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_organizerId_createdAt_idx" ON "Event"("organizerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "OrganizerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
