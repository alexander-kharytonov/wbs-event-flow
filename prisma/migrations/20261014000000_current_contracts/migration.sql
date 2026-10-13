BEGIN;

-- Current contracts only. Incompatible existing rows fail these constraints;
-- no payload, revision, participant or delivery history is repaired or backfilled.
ALTER TABLE "Event" DROP COLUMN "descriptionFormat";
DROP TYPE "DescriptionFormat";

ALTER TABLE "Attendee" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "ApplicationGuest" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "Communication" ALTER COLUMN "requestDigest" SET NOT NULL;
ALTER TABLE "EmailOutbox" ALTER COLUMN "communicationId" SET NOT NULL;

ALTER TABLE "ApplicationGuest" DROP CONSTRAINT "ApplicationGuest_shape_check";
ALTER TABLE "ApplicationGuest" ADD CONSTRAINT "ApplicationGuest_shape_check"
CHECK ("position" BETWEEN 0 AND 9
  AND char_length("name") BETWEEN 1 AND 200 AND "name" = btrim("name")
  AND "email" = lower(btrim("email")) AND char_length("email") > 0);

-- PRIMARY has no declaration. Every GUEST participates in both existing
-- composite FKs, binding its declaration and Registration to one Application.
ALTER TABLE "Attendee" DROP CONSTRAINT "Attendee_guest_provenance_check";
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_guest_provenance_check"
CHECK ((kind = 'PRIMARY' AND "applicationGuestId" IS NULL AND "applicationGuestApplicationId" IS NULL)
  OR (kind = 'GUEST' AND "applicationGuestId" IS NOT NULL AND "applicationGuestApplicationId" IS NOT NULL));

ALTER TABLE "Communication" DROP CONSTRAINT "Communication_requestDigest_check";
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_requestDigest_check"
CHECK ("requestDigest" ~ '^[a-f0-9]{64}$');

ALTER TABLE "EmailOutbox" DROP CONSTRAINT "EmailOutbox_communication_email_check";
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_communication_email_check"
CHECK ("recipientEmail" = lower(btrim("recipientEmail")));

-- The required communicationId now enforces this for every delivery type.
ALTER TABLE "EmailOutbox" DROP CONSTRAINT "EmailOutbox_manual_communication_check";

COMMIT;
