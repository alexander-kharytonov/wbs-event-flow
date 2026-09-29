-- Stop application writers, apply, generate the client, and run db:backfill-tickets
-- before resuming the matching application. The Node backfill uses canonical crypto.
CREATE TABLE "Ticket" (
  "id" UUID NOT NULL,
  "registrationId" UUID NOT NULL,
  "number" TEXT NOT NULL,
  "credentialHash" TEXT NOT NULL,
  "credentialEncrypted" TEXT NOT NULL,
  "anonymousAccessHash" TEXT,
  "anonymousAccessEncrypted" TEXT,
  "issuedAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3),
  CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ticket_revocation_time_check" CHECK ("revokedAt" IS NULL OR "revokedAt" >= "issuedAt"),
  CONSTRAINT "Ticket_anonymous_access_pair_check" CHECK (("anonymousAccessHash" IS NULL) = ("anonymousAccessEncrypted" IS NULL))
);
CREATE UNIQUE INDEX "Ticket_registrationId_key" ON "Ticket"("registrationId");
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");
CREATE UNIQUE INDEX "Ticket_credentialHash_key" ON "Ticket"("credentialHash");
CREATE UNIQUE INDEX "Ticket_anonymousAccessHash_key" ON "Ticket"("anonymousAccessHash");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
