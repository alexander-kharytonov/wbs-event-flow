-- CreateEnum
CREATE TYPE "RegistrationFieldType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'CHECKBOX');

-- CreateTable
CREATE TABLE "RegistrationForm" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RegistrationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationField" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "type" "RegistrationFieldType" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RegistrationField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationFieldOption" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RegistrationFieldOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationForm_eventId_key" ON "RegistrationForm"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationField_formId_position_key" ON "RegistrationField"("formId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationFieldOption_fieldId_position_key" ON "RegistrationFieldOption"("fieldId", "position");

-- AddForeignKey
ALTER TABLE "RegistrationForm" ADD CONSTRAINT "RegistrationForm_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationField" ADD CONSTRAINT "RegistrationField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "RegistrationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationFieldOption" ADD CONSTRAINT "RegistrationFieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "RegistrationField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing event starts with an empty form; no custom questions are seeded.
INSERT INTO "RegistrationForm" ("id", "eventId", "createdAt", "updatedAt")
SELECT 'registration_form_' || "id", "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Event";
