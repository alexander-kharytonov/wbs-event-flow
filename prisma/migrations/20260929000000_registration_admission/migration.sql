-- Apply with application writers stopped; deploy the matching writers before resuming.
BEGIN;

-- Stabilize history for preflight and backfill, including direct SQL writers.
LOCK TABLE "Application" IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Application"
    WHERE (status = 'PENDING' AND ("reviewedAt" IS NOT NULL OR "withdrawnAt" IS NOT NULL))
       OR (status IN ('APPROVED', 'REJECTED') AND ("reviewedAt" IS NULL OR "withdrawnAt" IS NOT NULL))
       OR (status = 'WITHDRAWN' AND "withdrawnAt" IS NULL)
       OR "reviewedAt" < "createdAt"
       OR "withdrawnAt" < "createdAt"
       OR "withdrawnAt" < "reviewedAt"
  ) THEN
    RAISE EXCEPTION 'Registration backfill: ambiguous Application lifecycle timestamps';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Application"
    WHERE email = '' OR email <> lower(btrim(email)) OR email ~ '[[:space:]]'
       OR email !~ '^[^@]+@[^@]+\.[^@]+$'
  ) THEN
    RAISE EXCEPTION 'Registration backfill: noncanonical or invalid Application email';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Application" a
    LEFT JOIN "Event" e ON e.id = a."eventId"
    LEFT JOIN "EventRevision" r ON r.id = a."eventRevisionId" AND r."eventId" = a."eventId"
    LEFT JOIN "user" u ON u.id = a."userId"
    WHERE e.id IS NULL OR r.id IS NULL OR (a."userId" IS NOT NULL AND u.id IS NULL)
  ) OR EXISTS (
    SELECT 1 FROM "ApplicationAnswer" answer
    LEFT JOIN "Application" a ON a.id = answer."applicationId"
    WHERE a.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM "ApplicationAnswerOption" option
    LEFT JOIN "ApplicationAnswer" answer ON answer.id = option."answerId"
    WHERE answer.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Registration backfill: broken Application history references';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Application" WHERE status = 'APPROVED'
    GROUP BY "eventId", email HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM "Application" WHERE status = 'APPROVED' AND "userId" IS NOT NULL
    GROUP BY "eventId", "userId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Registration backfill: active identity collision';
  END IF;
END $$;

CREATE UNIQUE INDEX "Application_eventId_id_key" ON "Application"("eventId", "id");

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

INSERT INTO "Registration" (
  "id", "eventId", "sourceApplicationId", "userId", "attendeeName", "attendeeEmail", "createdAt", "revokedAt"
)
SELECT uuidv7(), "eventId", id, "userId", "fullName", email, "reviewedAt",
       CASE WHEN status = 'WITHDRAWN' THEN "withdrawnAt" ELSE NULL END
FROM "Application"
WHERE (status = 'APPROVED' AND "reviewedAt" IS NOT NULL)
   OR (status = 'WITHDRAWN' AND "reviewedAt" IS NOT NULL AND "withdrawnAt" IS NOT NULL);

CREATE UNIQUE INDEX "Registration_sourceApplicationId_key" ON "Registration"("sourceApplicationId");
CREATE UNIQUE INDEX "Registration_active_user_key" ON "Registration"("eventId", "userId")
  WHERE (("revokedAt" IS NULL) AND ("userId" IS NOT NULL));
CREATE UNIQUE INDEX "Registration_active_email_key" ON "Registration"("eventId", "attendeeEmail")
  WHERE ("revokedAt" IS NULL);

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_sourceApplicationId_fkey"
  FOREIGN KEY ("eventId", "sourceApplicationId") REFERENCES "Application"("eventId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_revocation_time_check"
  CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Application" a
    FULL JOIN "Registration" r ON r."sourceApplicationId" = a.id
    WHERE CASE
      WHEN a.status = 'APPROVED' OR (a.status = 'WITHDRAWN' AND a."reviewedAt" IS NOT NULL)
      THEN r.id IS NULL
        OR r."eventId" IS DISTINCT FROM a."eventId"
        OR r."userId" IS DISTINCT FROM a."userId"
        OR r."attendeeName" IS DISTINCT FROM a."fullName"
        OR r."attendeeEmail" IS DISTINCT FROM a.email
        OR r."createdAt" IS DISTINCT FROM a."reviewedAt"
        OR r."revokedAt" IS DISTINCT FROM CASE WHEN a.status = 'WITHDRAWN' THEN a."withdrawnAt" ELSE NULL END
      ELSE r.id IS NOT NULL
    END
  ) THEN
    RAISE EXCEPTION 'Registration backfill: Application/admission correspondence failed';
  END IF;
END $$;

COMMIT;
