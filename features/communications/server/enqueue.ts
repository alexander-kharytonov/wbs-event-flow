import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  type ActorSnapshot,
  actorSnapshotSchema,
  type CommunicationTrigger,
  communicationSubjectSchema,
  idempotencyKeySchema,
  requestDigestSchema,
  transactionalContextSchema,
} from "@/features/communications/server/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { emailOutboxChannel } from "@/lib/email-outbox/enqueue";
import { emailPayloadSchemas } from "@/lib/email-outbox/payload";

// Fixed-schema values only. Sorting keys makes digest independent of JS key order.
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function communicationRequestDigest(value: {
  eventId: string;
  trigger: CommunicationTrigger;
  subject: string;
  contextSnapshot: z.infer<typeof transactionalContextSchema>;
  actor: ActorSnapshot;
  recipients: {
    recipientEmail: string;
    payload: unknown;
    deduplicationKey: string;
  }[];
}) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

type TransactionalCommunicationInput = {
  eventId: string;
  trigger: CommunicationTrigger;
  subject: string;
  contextSnapshot: unknown;
  actor: ActorSnapshot;
  idempotencyKey: string;
  requestDigest?: string;
  // Server-selected historical addresses and existing delivery deduplication keys.
  recipients: readonly {
    recipientEmail: string;
    payload: unknown;
    deduplicationKey: string;
  }[];
};

// Used by transactional Event writers; no manual enqueue entry point.
// Caller must propagate failures to roll back its
// domain mutation as well. No independent transaction and no SMTP here.
export async function enqueueTransactionalCommunication(
  tx: Prisma.TransactionClient,
  input: TransactionalCommunicationInput,
) {
  const eventId = z.uuid().parse(input.eventId);
  const idempotencyKey = idempotencyKeySchema.parse(input.idempotencyKey);
  const contextSnapshot = transactionalContextSchema.parse(
    input.contextSnapshot,
  );
  const subject = communicationSubjectSchema.parse(input.subject);
  const actor = actorSnapshotSchema.parse(input.actor);

  if (contextSnapshot.trigger !== input.trigger) {
    throw new Error("Communication trigger mismatch.");
  }

  const recipients = new Map<
    string,
    {
      recipientEmail: string;
      payload: Prisma.InputJsonValue;
      deduplicationKey: string;
    }
  >();

  for (const recipient of input.recipients) {
    const recipientEmail = z
      .email()
      .parse(recipient.recipientEmail.trim().toLowerCase());
    const payload = emailPayloadSchemas[input.trigger].parse(recipient.payload);
    const deduplicationKey = z
      .string()
      .min(1)
      .parse(recipient.deduplicationKey);
    const previous = recipients.get(recipientEmail);

    if (
      previous &&
      (canonicalJson(previous.payload) !== canonicalJson(payload) ||
        previous.deduplicationKey !== deduplicationKey)
    ) {
      throw new Error("Conflicting snapshots for one recipient.");
    }

    recipients.set(recipientEmail, {
      recipientEmail,
      payload,
      deduplicationKey,
    });
  }

  const frozenRecipients = [...recipients.values()].sort((a, b) =>
    a.recipientEmail.localeCompare(b.recipientEmail, "en"),
  );
  const requestDigest = communicationRequestDigest({
    eventId,
    trigger: input.trigger,
    subject,
    contextSnapshot,
    actor,
    recipients: frozenRecipients,
  });

  if (
    input.requestDigest !== undefined &&
    requestDigestSchema.parse(input.requestDigest) !== requestDigest
  ) {
    throw new Error("Communication request digest mismatch.");
  }

  const [isolation] = await tx.$queryRaw<
    { level: string }[]
  >`SELECT current_setting('transaction_isolation') AS level`;

  if (isolation.level !== "read committed") {
    throw new Error("Communication enqueue requires ReadCommitted.");
  }

  // Reentrant when the domain writer already holds its required Event lock.
  const events = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;

  if (events.length !== 1) {
    throw new Error("Communication event unavailable.");
  }

  const existing = await tx.communication.findUnique({
    where: { eventId_idempotencyKey: { eventId, idempotencyKey } },
    select: { id: true, requestDigest: true, recipientCount: true },
  });

  if (existing) {
    if (existing.requestDigest !== requestDigest) {
      throw new Error("Communication idempotency conflict.");
    }

    return {
      id: existing.id,
      recipientCount: existing.recipientCount,
      created: false,
    };
  }

  // Nested create is one atomic write. No skipDuplicates: a collision fails all.
  const communication = await tx.communication.create({
    data: {
      eventId,
      kind: "TRANSACTIONAL",
      trigger: input.trigger,
      ...actor,
      subject,
      contextSnapshot,
      recipientCount: frozenRecipients.length,
      idempotencyKey,
      requestDigest,
      deliveries: {
        create: frozenRecipients.map((recipient) => ({
          ...recipient,
          type: input.trigger,
        })),
      },
    },
    select: { id: true, recipientCount: true },
  });

  if (frozenRecipients.length > 0) {
    await tx.$executeRaw`SELECT pg_notify(${emailOutboxChannel}::text, ''::text)`;
  }

  return { ...communication, created: true };
}
