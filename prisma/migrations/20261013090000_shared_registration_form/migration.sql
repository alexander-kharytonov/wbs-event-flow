BEGIN;

-- Remove obsolete guest-only workspace definitions. Submitted history uses frozen IDs.
DELETE FROM "RegistrationField" WHERE "subject" = 'GUEST';
DROP INDEX "RegistrationField_formId_subject_position_key";
ALTER TABLE "RegistrationField" DROP COLUMN "subject";
CREATE UNIQUE INDEX "RegistrationField_formId_position_key" ON "RegistrationField"("formId", "position");
ALTER TABLE "Event" DROP COLUMN "guestPolicy";
DROP TYPE "RegistrationFieldSubject";
DROP TYPE "GuestPolicy";

COMMIT;
