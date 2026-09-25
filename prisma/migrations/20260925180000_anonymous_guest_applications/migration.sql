-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventRevisionId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAnswer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "textValue" TEXT,
    "booleanValue" BOOLEAN,

    CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAnswerOption" (
    "answerId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "ApplicationAnswerOption_pkey" PRIMARY KEY ("answerId","optionId")
);

-- CreateIndex
CREATE INDEX "Application_eventId_status_idx" ON "Application"("eventId", "status");

-- CreateIndex
CREATE INDEX "Application_eventRevisionId_idx" ON "Application"("eventRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_eventId_email_key" ON "Application"("eventId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationAnswer_applicationId_fieldId_key" ON "ApplicationAnswer"("applicationId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRevision_eventId_id_key" ON "EventRevision"("eventId", "id");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_eventId_eventRevisionId_fkey" FOREIGN KEY ("eventId", "eventRevisionId") REFERENCES "EventRevision"("eventId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswerOption" ADD CONSTRAINT "ApplicationAnswerOption_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ApplicationAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
