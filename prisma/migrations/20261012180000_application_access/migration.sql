ALTER TABLE "Application"
  ADD COLUMN "anonymousAccessHash" TEXT,
  ADD COLUMN "anonymousAccessEncrypted" TEXT;
CREATE UNIQUE INDEX "Application_anonymousAccessHash_key" ON "Application"("anonymousAccessHash");
ALTER TABLE "Application" ADD CONSTRAINT "Application_anonymous_access_pair_check"
CHECK (("anonymousAccessHash" IS NULL) = ("anonymousAccessEncrypted" IS NULL));
ALTER TABLE "Application" ADD CONSTRAINT "Application_withdrawn_access_check"
CHECK (status <> 'WITHDRAWN' OR "anonymousAccessHash" IS NULL);
