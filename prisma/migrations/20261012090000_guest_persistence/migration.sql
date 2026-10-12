-- CreateEnum
CREATE TYPE "GuestPolicy" AS ENUM ('FLEXIBLE', 'APPROVAL_REQUIRED');

-- CreateEnum
CREATE TYPE "RegistrationFieldSubject" AS ENUM ('APPLICANT', 'GUEST');

-- DropIndex
DROP INDEX "RegistrationField_formId_position_key";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "guestPolicy" "GuestPolicy" NOT NULL DEFAULT 'FLEXIBLE';

-- AlterTable
ALTER TABLE "RegistrationField" ADD COLUMN     "subject" "RegistrationFieldSubject" NOT NULL DEFAULT 'APPLICANT';

-- AlterTable
ALTER TABLE "Attendee" ADD COLUMN     "applicationGuestApplicationId" UUID,
ADD COLUMN     "applicationGuestId" UUID;

-- CreateTable
CREATE TABLE "ApplicationGuest" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "ApplicationGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationGuestAnswer" (
    "id" UUID NOT NULL,
    "applicationGuestId" UUID NOT NULL,
    "fieldId" UUID NOT NULL,
    "textValue" TEXT,
    "booleanValue" BOOLEAN,

    CONSTRAINT "ApplicationGuestAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationGuestAnswerOption" (
    "answerId" UUID NOT NULL,
    "optionId" UUID NOT NULL,

    CONSTRAINT "ApplicationGuestAnswerOption_pkey" PRIMARY KEY ("answerId","optionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationGuest_id_applicationId_key" ON "ApplicationGuest"("id", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationGuest_applicationId_position_key" ON "ApplicationGuest"("applicationId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationGuestAnswer_applicationGuestId_fieldId_key" ON "ApplicationGuestAnswer"("applicationGuestId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationField_formId_subject_position_key" ON "RegistrationField"("formId", "subject", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_id_sourceApplicationId_key" ON "Registration"("id", "sourceApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendee_applicationGuestId_key" ON "Attendee"("applicationGuestId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendee_applicationGuestId_applicationGuestApplicationId_key" ON "Attendee"("applicationGuestId", "applicationGuestApplicationId");

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_applicationGuestId_applicationGuestApplicationId_fkey" FOREIGN KEY ("applicationGuestId", "applicationGuestApplicationId") REFERENCES "ApplicationGuest"("id", "applicationId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_registrationId_applicationGuestApplicationId_fkey" FOREIGN KEY ("registrationId", "applicationGuestApplicationId") REFERENCES "Registration"("id", "sourceApplicationId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ApplicationGuest" ADD CONSTRAINT "ApplicationGuest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ApplicationGuestAnswer" ADD CONSTRAINT "ApplicationGuestAnswer_applicationGuestId_fkey" FOREIGN KEY ("applicationGuestId") REFERENCES "ApplicationGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationGuestAnswerOption" ADD CONSTRAINT "ApplicationGuestAnswerOption_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ApplicationGuestAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A declaration is a submitted person, never an account or a capacity reservation.
ALTER TABLE "ApplicationGuest" ADD CONSTRAINT "ApplicationGuest_shape_check"
CHECK ("position" BETWEEN 0 AND 9
  AND char_length("name") BETWEEN 1 AND 200 AND "name" = btrim("name")
  AND ("email" IS NULL OR ("email" = lower(btrim("email")) AND char_length("email") > 0)));
ALTER TABLE "ApplicationGuestAnswer" ADD CONSTRAINT "ApplicationGuestAnswer_value_check"
CHECK ("textValue" IS NULL OR "booleanValue" IS NULL);
-- Both composite FKs must participate: no partial-null provenance escape.
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_guest_provenance_check"
CHECK (("applicationGuestId" IS NULL AND "applicationGuestApplicationId" IS NULL)
  OR (kind = 'GUEST' AND "applicationGuestId" IS NOT NULL AND "applicationGuestApplicationId" IS NOT NULL));
