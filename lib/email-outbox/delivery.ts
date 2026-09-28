import "server-only";
import { z } from "zod";
import type { EmailOutbox } from "@/generated/prisma/client";
import { renderOutboxEmail } from "@/lib/email-outbox/render";
import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

export const emailBatchSize = 5;
export const emailLeaseMs = 5 * 60_000;
const retryDelaysMs = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

export async function claimEmailBatch(workerId: string) {
  const rows = await prisma.$transaction(
    (tx) => tx.$queryRaw<EmailOutbox[]>`
      WITH candidates AS (
        SELECT q."id" FROM "EmailOutbox" AS q
        WHERE (q."status" = 'PENDING' AND q."nextAttemptAt" <= now())
          OR (q."status" = 'PROCESSING' AND q."lockedAt" <
            now() - (${emailLeaseMs}::double precision * interval '1 millisecond'))
        ORDER BY q."nextAttemptAt", q."createdAt", q."id"
        LIMIT ${emailBatchSize}::integer
        FOR UPDATE OF q SKIP LOCKED
      )
      UPDATE "EmailOutbox" AS q SET
        "status" = CASE WHEN q."attempts" >= 5 THEN 'FAILED'::"EmailOutboxStatus"
          ELSE 'PROCESSING'::"EmailOutboxStatus" END,
        "attempts" = q."attempts" + CASE WHEN q."attempts" < 5 THEN 1 ELSE 0 END,
        "lockedAt" = CASE WHEN q."attempts" >= 5 THEN NULL ELSE now() END,
        "lockedBy" = CASE WHEN q."attempts" >= 5 THEN NULL ELSE ${workerId}::text END,
        "nextAttemptAt" = CASE WHEN q."attempts" >= 5 THEN NULL ELSE q."nextAttemptAt" END,
        "lastError" = CASE WHEN q."attempts" >= 5
          THEN 'Delivery attempt limit reached after lease expiry.' ELSE q."lastError" END,
        "updatedAt" = now()
      FROM candidates AS c WHERE q."id" = c."id"
      RETURNING q.*`,
    { isolationLevel: "ReadCommitted" },
  );

  // A crashed fifth attempt expires to FAILED, never to a sixth SMTP attempt.
  return rows;
}

export async function finishEmailDelivery(
  row: Pick<EmailOutbox, "id" | "attempts">,
  workerId: string,
  error: "Invalid email payload." | "Email delivery failed." | null,
) {
  if (error === null) {
    return prisma.$executeRaw`
      UPDATE "EmailOutbox" SET "status" = 'SENT', "sentAt" = now(),
        "nextAttemptAt" = NULL, "lockedAt" = NULL, "lockedBy" = NULL,
        "lastError" = NULL, "updatedAt" = now()
      WHERE "id" = ${row.id}::uuid AND "status" = 'PROCESSING'
        AND "lockedBy" = ${workerId}::text AND "attempts" = ${row.attempts}::integer`;
  }

  const delayMs = retryDelaysMs[row.attempts - 1] ?? null;

  return prisma.$executeRaw`
    UPDATE "EmailOutbox" SET
      "status" = CASE WHEN ${delayMs}::double precision IS NULL
        THEN 'FAILED'::"EmailOutboxStatus" ELSE 'PENDING'::"EmailOutboxStatus" END,
      "nextAttemptAt" = now() + (${delayMs}::double precision * interval '1 millisecond'),
      "lockedAt" = NULL, "lockedBy" = NULL,
      "lastError" = ${error}::text, "updatedAt" = now()
    WHERE "id" = ${row.id}::uuid AND "status" = 'PROCESSING'
      AND "lockedBy" = ${workerId}::text AND "attempts" = ${row.attempts}::integer`;
}

export async function deliverClaimedEmail(row: EmailOutbox, workerId: string) {
  let message: ReturnType<typeof renderOutboxEmail>;

  try {
    z.email().parse(row.recipientEmail);
    message = renderOutboxEmail(row.type, row.payload);
  } catch {
    await finishEmailDelivery(row, workerId, "Invalid email payload.");

    return;
  }

  let error: "Email delivery failed." | null = null;

  try {
    // Bounded network delivery, outside the completed claim transaction.
    await sendMail({ to: row.recipientEmail, ...message }, 45_000);
  } catch {
    error = "Email delivery failed.";
  }

  // A database completion failure must leave the lease for recovery, rather
  // than being misclassified as an SMTP failure. Zero means lost ownership.
  await finishEmailDelivery(row, workerId, error);
}
