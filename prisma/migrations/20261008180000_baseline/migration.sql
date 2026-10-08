-- Fresh PostgreSQL 18 schema; no historical data transformations.
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "EventAccountRequirement" AS ENUM ('REQUIRED', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "RegistrationFieldType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AttendeeKind" AS ENUM ('PRIMARY', 'GUEST');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "CommunicationKind" AS ENUM ('MANUAL', 'TRANSACTIONAL');

-- CreateEnum
CREATE TYPE "CommunicationTrigger" AS ENUM ('EVENT_CANCELLED', 'APPLICATION_RECEIVED', 'NEW_APPLICATION', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED');

-- CreateEnum
CREATE TYPE "CommunicationAudience" AS ENUM ('ALL_ACTIVE_ATTENDEES', 'PRIMARY_ATTENDEES', 'CHECKED_IN', 'NOT_ARRIVED', 'PENDING_APPLICATIONS', 'EVENT_STAFF');

-- CreateEnum
CREATE TYPE "CommunicationActorRole" AS ENUM ('OWNER', 'MANAGER', 'RECEPTION');

-- CreateEnum
CREATE TYPE "EmailOutboxType" AS ENUM ('APPLICATION_RECEIVED', 'NEW_APPLICATION', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'EVENT_CANCELLED', 'MANUAL_EVENT_MESSAGE');

-- CreateEnum
CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('MANAGER', 'RECEPTION');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "organizerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "visibility" "EventVisibility" NOT NULL DEFAULT 'PRIVATE',
    "accountRequirement" "EventAccountRequirement" NOT NULL DEFAULT 'OPTIONAL',
    "maxGuestsPerRegistration" INTEGER NOT NULL DEFAULT 0,
    "badgeLayout" JSONB,
    "capacity" INTEGER,
    "registrationOpensAt" TIMESTAMPTZ(3),
    "registrationClosesAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" TEXT,
    "archivedAt" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "publicId" UUID,
    "publishedRevisionId" UUID,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" UUID NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationForm" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RegistrationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationField" (
    "id" UUID NOT NULL,
    "formId" UUID NOT NULL,
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
    "id" UUID NOT NULL,
    "fieldId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RegistrationFieldOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRevision" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "eventRevisionId" UUID NOT NULL,
    "userId" UUID,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "withdrawnAt" TIMESTAMPTZ(3),

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" UUID NOT NULL,
    "attendeeId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "credentialEncrypted" TEXT NOT NULL,
    "anonymousAccessHash" TEXT,
    "anonymousAccessEncrypted" TEXT,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "sourceApplicationId" UUID NOT NULL,
    "userId" UUID,
    "attendeeName" TEXT NOT NULL,
    "attendeeEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendee" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "kind" "AttendeeKind" NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Attendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "attendeeId" UUID NOT NULL,
    "ticketId" UUID,
    "checkedInAt" TIMESTAMPTZ(3) NOT NULL,
    "checkedInByUserId" UUID,
    "method" "AttendanceMethod" NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAnswer" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "fieldId" UUID NOT NULL,
    "textValue" TEXT,
    "booleanValue" BOOLEAN,

    CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAnswerOption" (
    "answerId" UUID NOT NULL,
    "optionId" UUID NOT NULL,

    CONSTRAINT "ApplicationAnswerOption_pkey" PRIMARY KEY ("answerId","optionId")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "kind" "CommunicationKind" NOT NULL,
    "trigger" "CommunicationTrigger",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" UUID,
    "actorNameSnapshot" TEXT,
    "actorRoleSnapshot" "CommunicationActorRole",
    "audience" "CommunicationAudience",
    "subject" TEXT NOT NULL,
    "message" TEXT,
    "contextSnapshot" JSONB NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestDigest" TEXT,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" UUID NOT NULL,
    "communicationId" UUID,
    "type" "EmailOutboxType" NOT NULL,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "deduplicationKey" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMPTZ(3),
    "lockedBy" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventStaff" (
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "StaffRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EventStaff_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerProfile_userId_key" ON "OrganizerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_publicId_key" ON "Event"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_publishedRevisionId_key" ON "Event"("publishedRevisionId");

-- CreateIndex
CREATE INDEX "Event_organizerId_createdAt_idx" ON "Event"("organizerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_id_publishedRevisionId_key" ON "Event"("id", "publishedRevisionId");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationForm_eventId_key" ON "RegistrationForm"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationField_formId_position_key" ON "RegistrationField"("formId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationFieldOption_fieldId_position_key" ON "RegistrationFieldOption"("fieldId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "EventRevision_eventId_id_key" ON "EventRevision"("eventId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "EventRevision_eventId_number_key" ON "EventRevision"("eventId", "number");

-- CreateIndex
CREATE INDEX "Application_eventId_userId_createdAt_idx" ON "Application"("eventId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "Application_eventId_status_idx" ON "Application"("eventId", "status");

-- CreateIndex
CREATE INDEX "Application_eventRevisionId_idx" ON "Application"("eventRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_eventId_id_key" ON "Application"("eventId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Application_eventId_email_key" ON "Application"("eventId", "email") WHERE (status = ANY (ARRAY['PENDING'::"ApplicationStatus", 'APPROVED'::"ApplicationStatus", 'REJECTED'::"ApplicationStatus"]));

-- CreateIndex
CREATE UNIQUE INDEX "Application_eventId_userId_key" ON "Application"("eventId", "userId") WHERE (status = ANY (ARRAY['PENDING'::"ApplicationStatus", 'APPROVED'::"ApplicationStatus", 'REJECTED'::"ApplicationStatus"]));

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_attendeeId_key" ON "Ticket"("attendeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_credentialHash_key" ON "Ticket"("credentialHash");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_anonymousAccessHash_key" ON "Ticket"("anonymousAccessHash");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_attendeeId_id_key" ON "Ticket"("attendeeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_sourceApplicationId_key" ON "Registration"("sourceApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_active_user_key" ON "Registration"("eventId", "userId") WHERE (("revokedAt" IS NULL) AND ("userId" IS NOT NULL));

-- CreateIndex
CREATE UNIQUE INDEX "Registration_active_email_key" ON "Registration"("eventId", "attendeeEmail") WHERE ("revokedAt" IS NULL);

-- CreateIndex
CREATE INDEX "Attendee_registrationId_revokedAt_idx" ON "Attendee"("registrationId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attendee_primary_key" ON "Attendee"("registrationId") WHERE (kind = 'PRIMARY'::"AttendeeKind");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_attendeeId_key" ON "Attendance"("attendeeId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationAnswer_applicationId_fieldId_key" ON "ApplicationAnswer"("applicationId", "fieldId");

-- CreateIndex
CREATE INDEX "Communication_eventId_createdAt_id_idx" ON "Communication"("eventId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Communication_eventId_kind_createdAt_idx" ON "Communication"("eventId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "Communication_actorUserId_kind_createdAt_idx" ON "Communication"("actorUserId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Communication_eventId_idempotencyKey_key" ON "Communication"("eventId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_deduplicationKey_key" ON "EmailOutbox"("deduplicationKey");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_nextAttemptAt_createdAt_idx" ON "EmailOutbox"("status", "nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_lockedAt_idx" ON "EmailOutbox"("status", "lockedAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_communicationId_status_id_idx" ON "EmailOutbox"("communicationId", "status", "id");

-- CreateIndex
CREATE INDEX "EmailOutbox_type_status_communicationId_idx" ON "EmailOutbox"("type", "status", "communicationId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_communicationId_recipientEmail_key" ON "EmailOutbox"("communicationId", "recipientEmail");

-- CreateIndex
CREATE INDEX "EventStaff_userId_idx" ON "EventStaff"("userId");

-- AddForeignKey
ALTER TABLE "OrganizerProfile" ADD CONSTRAINT "OrganizerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "OrganizerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_id_publishedRevisionId_fkey" FOREIGN KEY ("id", "publishedRevisionId") REFERENCES "EventRevision"("eventId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationForm" ADD CONSTRAINT "RegistrationForm_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationField" ADD CONSTRAINT "RegistrationField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "RegistrationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationFieldOption" ADD CONSTRAINT "RegistrationFieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "RegistrationField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRevision" ADD CONSTRAINT "EventRevision_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_eventId_eventRevisionId_fkey" FOREIGN KEY ("eventId", "eventRevisionId") REFERENCES "EventRevision"("eventId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_sourceApplicationId_fkey" FOREIGN KEY ("eventId", "sourceApplicationId") REFERENCES "Application"("eventId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_attendeeId_ticketId_fkey" FOREIGN KEY ("attendeeId", "ticketId") REFERENCES "Ticket"("attendeeId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_checkedInByUserId_fkey" FOREIGN KEY ("checkedInByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswerOption" ADD CONSTRAINT "ApplicationAnswerOption_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ApplicationAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EventStaff" ADD CONSTRAINT "EventStaff_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventStaff" ADD CONSTRAINT "EventStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Current custom SQL invariants, preserved from the historical migrations.
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_method_ticket_check" CHECK (
    ("method"::text = 'QR' AND "ticketId" IS NOT NULL)
    OR ("method"::text = 'MANUAL' AND "ticketId" IS NULL)
  );

ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_guest_user_check" CHECK (kind <> 'GUEST' OR "userId" IS NULL);

ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_revocation_time_check" CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

ALTER TABLE "Communication" ADD CONSTRAINT "Communication_actor_snapshot_check" CHECK (
    ("actorNameSnapshot" IS NULL) = ("actorRoleSnapshot" IS NULL)
    AND ("actorUserId" IS NULL OR "actorNameSnapshot" IS NOT NULL)
    AND ("actorNameSnapshot" IS NULL OR char_length("actorNameSnapshot") > 0)
  );

ALTER TABLE "Communication" ADD CONSTRAINT "Communication_context_object_check" CHECK (
    jsonb_typeof("contextSnapshot") = 'object'
  );

ALTER TABLE "Communication" ADD CONSTRAINT "Communication_idempotencyKey_check" CHECK (
    char_length("idempotencyKey") BETWEEN 1 AND 200 AND "idempotencyKey" ~ '^[A-Za-z0-9:._-]+$'
  );

ALTER TABLE "Communication" ADD CONSTRAINT "Communication_kind_content_check" CHECK (
    ("kind" = 'MANUAL' AND "trigger" IS NULL AND "audience" IS NOT NULL
      AND "message" IS NOT NULL AND char_length("message") BETWEEN 1 AND 10000
      AND "requestDigest" IS NOT NULL AND "actorNameSnapshot" IS NOT NULL
      AND "actorRoleSnapshot" IS NOT NULL AND "actorRoleSnapshot" IN ('OWNER', 'MANAGER'))
    OR ("kind" = 'TRANSACTIONAL' AND "trigger" IS NOT NULL AND "audience" IS NULL AND "message" IS NULL)
  );

ALTER TABLE "Communication" ADD CONSTRAINT "Communication_recipientCount_check" CHECK ("recipientCount" >= 0);

ALTER TABLE "Communication" ADD CONSTRAINT "Communication_requestDigest_check" CHECK (
    "requestDigest" IS NULL OR "requestDigest" ~ '^[a-f0-9]{64}$'
  );

ALTER TABLE "Communication" ADD CONSTRAINT "Communication_subject_check" CHECK (char_length("subject") BETWEEN 1 AND 200);

ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_communication_email_check" CHECK (
    "communicationId" IS NULL OR "recipientEmail" = lower(btrim("recipientEmail"))
  );

ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_manual_communication_check" CHECK (
    "type"::text <> 'MANUAL_EVENT_MESSAGE' OR "communicationId" IS NOT NULL
  );

ALTER TABLE "Event" ADD CONSTRAINT "Event_cancellation_reason_check" CHECK (
  ("cancelledAt" IS NULL AND "cancellationReason" IS NULL)
  OR ("cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL
      AND "cancellationReason" ~ '[^[:space:]]')
);

ALTER TABLE "Event" ADD CONSTRAINT "Event_guest_limit_check" CHECK ("maxGuestsPerRegistration" BETWEEN 0 AND 10);

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_revocation_time_check" CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_anonymous_access_pair_check" CHECK (("anonymousAccessHash" IS NULL) = ("anonymousAccessEncrypted" IS NULL));

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_revocation_time_check" CHECK ("revokedAt" IS NULL OR "revokedAt" >= "issuedAt");

COMMIT;
