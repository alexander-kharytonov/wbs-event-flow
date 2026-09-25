-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "contentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "publishedRevisionId" TEXT;

-- CreateTable
CREATE TABLE "EventRevision" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventRevision_eventId_number_key" ON "EventRevision"("eventId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "EventRevision_eventId_contentVersion_key" ON "EventRevision"("eventId", "contentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "Event_publicId_key" ON "Event"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_publishedRevisionId_key" ON "Event"("publishedRevisionId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "EventRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRevision" ADD CONSTRAINT "EventRevision_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

