import "server-only";
import { z } from "zod";
import type { EmailOutbox } from "@/generated/prisma/client";
import { renderOutboxEmail } from "@/lib/email-outbox/render";
import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { notifyEventChanged } from "@/lib/realtime/application-notifications";

export const emailBatchSize = 5;
export const emailLeaseMs = 5 * 60_000;
const retryDelaysMs = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
const maxPendingInvalidations = 50;
const globalForDelivery = globalThis as unknown as {
  deliveryInvalidations?: { pending: Set<string>; running: boolean };
};
const invalidations = globalForDelivery.deliveryInvalidations ?? {
  pending: new Set<string>(),
  running: false,
};
globalForDelivery.deliveryInvalidations = invalidations;

// One transaction at a time per process, including across development reloads.
// Overflow is deliberately dropped: reconnect/refresh recover missed signals.
// A change arriving during a flush stays pending for the next flush.
function invalidateDeliveryHistory(
  rows: readonly { communicationId: string | null }[],
) {
  for (const row of rows) {
    if (
      row.communicationId &&
      invalidations.pending.size < maxPendingInvalidations
    ) {
      invalidations.pending.add(row.communicationId);
    }
  }

  if (invalidations.running || invalidations.pending.size === 0) {
    return;
  }

  invalidations.running = true;
  void flushDeliveryInvalidations();
}

async function flushDeliveryInvalidations() {
  try {
    while (invalidations.pending.size > 0) {
      const ids = [...invalidations.pending];
      invalidations.pending.clear();

      try {
        await prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
            const communications = await tx.communication.findMany({
              where: { id: { in: ids } },
              select: { eventId: true },
            });

            for (const eventId of new Set(
              communications.map((row) => row.eventId),
            )) {
              await notifyEventChanged(tx, eventId);
            }
          },
          // Allow the shared pool's 5s connection-acquisition timeout to finish
          // before starting another best-effort transaction.
          { maxWait: 6000, timeout: 3000 },
        );
      } catch {
        // Drop this batch without retrying or touching delivery state.
      }
    }
  } finally {
    invalidations.running = false;
  }
}

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

  void invalidateDeliveryHistory(rows);

  // A crashed fifth attempt expires to FAILED, never to a sixth SMTP attempt.
  return rows;
}

export async function finishEmailDelivery(
  row: Pick<EmailOutbox, "id" | "attempts">,
  workerId: string,
  error: "Invalid email payload." | "Email delivery failed." | null,
) {
  if (error === null) {
    const updated = await prisma.$queryRaw<
      { communicationId: string | null }[]
    >`
      UPDATE "EmailOutbox" SET "status" = 'SENT', "sentAt" = now(),
        "nextAttemptAt" = NULL, "lockedAt" = NULL, "lockedBy" = NULL,
        "lastError" = NULL, "updatedAt" = now()
      WHERE "id" = ${row.id}::uuid AND "status" = 'PROCESSING'
        AND "lockedBy" = ${workerId}::text AND "attempts" = ${row.attempts}::integer
      RETURNING "communicationId"`;
    void invalidateDeliveryHistory(updated);

    return updated.length;
  }

  const delayMs = retryDelaysMs[row.attempts - 1] ?? null;

  const updated = await prisma.$queryRaw<{ communicationId: string | null }[]>`
    UPDATE "EmailOutbox" SET
      "status" = CASE WHEN ${delayMs}::double precision IS NULL
        THEN 'FAILED'::"EmailOutboxStatus" ELSE 'PENDING'::"EmailOutboxStatus" END,
      "nextAttemptAt" = now() + (${delayMs}::double precision * interval '1 millisecond'),
      "lockedAt" = NULL, "lockedBy" = NULL,
      "lastError" = ${error}::text, "updatedAt" = now()
    WHERE "id" = ${row.id}::uuid AND "status" = 'PROCESSING'
      AND "lockedBy" = ${workerId}::text AND "attempts" = ${row.attempts}::integer
    RETURNING "communicationId"`;
  void invalidateDeliveryHistory(updated);

  return updated.length;
}

export async function deliverClaimedEmail(row: EmailOutbox, workerId: string) {
  let message: Awaited<ReturnType<typeof renderOutboxEmail>>;

  try {
    z.email().parse(row.recipientEmail);
    message = await renderOutboxEmail(
      row.type,
      row.payload,
      row.communicationId,
    );
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
