import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export const manualCommunicationLimits = {
  recipients: 1000,
  subjectCharacters: 200,
  messageCharacters: 10_000,
  eventSendsPerHour: 5,
  actorSendsPerHour: 10,
  eventOutstandingRecipients: 2000,
  globalOutstandingRecipients: 10_000,
} as const;

export function assertManualAdmissionCapacity(input: {
  recipientCount: number;
  eventSends: number;
  actorSends: number;
  eventOutstanding: number;
  globalOutstanding: number;
}) {
  const limits = manualCommunicationLimits;

  if (
    !Number.isSafeInteger(input.recipientCount) ||
    input.recipientCount < 0 ||
    input.recipientCount > limits.recipients
  ) {
    throw new Error("Manual recipient limit exceeded.");
  }

  if (
    input.eventSends >= limits.eventSendsPerHour ||
    input.actorSends >= limits.actorSendsPerHour
  ) {
    throw new Error("Manual sending frequency limit exceeded.");
  }

  if (
    input.eventOutstanding + input.recipientCount >
      limits.eventOutstandingRecipients ||
    input.globalOutstanding + input.recipientCount >
      limits.globalOutstandingRecipients
  ) {
    throw new Error("Manual delivery queue limit exceeded.");
  }
}

// 27C primitive, NOT a reservation outside this transaction. Required protocol:
// ReadCommitted -> Event FOR UPDATE -> this global advisory lock -> fresh counts
// -> atomic Communication + all Outbox rows -> COMMIT. No later Event lock.
// Every future manual writer must use this lock, including any retry reactivation.
// Worker transitions only preserve/decrease outstanding counts and need no lock.
export async function checkManualCommunicationAdmission(
  tx: Prisma.TransactionClient,
  input: { eventId: string; actorUserId: string; recipientCount: number },
) {
  const [isolation] = await tx.$queryRaw<
    { level: string }[]
  >`SELECT current_setting('transaction_isolation') AS level`;

  if (isolation.level !== "read committed") {
    throw new Error("Manual admission requires ReadCommitted.");
  }

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(27001, 1)`;
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT clock_timestamp() AS now`;
  const since = new Date(clock.now.getTime() - 60 * 60_000);
  const eventSends = await tx.communication.count({
    where: { kind: "MANUAL", eventId: input.eventId, createdAt: { gt: since } },
  });
  const actorSends = await tx.communication.count({
    where: {
      kind: "MANUAL",
      actorUserId: input.actorUserId,
      createdAt: { gt: since },
    },
  });
  const outstanding = {
    type: "MANUAL_EVENT_MESSAGE",
    status: { in: ["PENDING", "PROCESSING"] },
  } satisfies Prisma.EmailOutboxWhereInput;
  const eventOutstanding = await tx.emailOutbox.count({
    where: { ...outstanding, communication: { eventId: input.eventId } },
  });
  const globalOutstanding = await tx.emailOutbox.count({ where: outstanding });
  assertManualAdmissionCapacity({
    recipientCount: input.recipientCount,
    eventSends,
    actorSends,
    eventOutstanding,
    globalOutstanding,
  });

  // Future writer persists this post-lock DB time for the sliding window.
  return { admittedAt: clock.now };
}
