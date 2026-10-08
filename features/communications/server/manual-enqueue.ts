import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { checkManualCommunicationAdmission } from "@/features/communications/server/admission";
import { resolveManualAudience } from "@/features/communications/server/audience";
import {
  manualAudienceSchema,
  manualContentSchema,
  manualContextSchema,
} from "@/features/communications/server/contracts";
import {
  captureCommunicationActor,
  getCommunicationSendEligibility,
} from "@/features/communications/server/eligibility";
import { ManualCommunicationError } from "@/features/communications/server/manual-error";
import type { Prisma } from "@/generated/prisma/client";
import { emailOutboxChannel } from "@/lib/email-outbox/enqueue";
import { notifyEventChanged } from "@/lib/realtime/application-notifications";

export const manualSendSchema = manualContentSchema.extend({
  eventId: z.uuid(),
  audience: manualAudienceSchema,
  requestKey: z.uuid(),
});

export const manualPreviewSchema = z.strictObject({
  eventId: z.uuid(),
  audience: manualAudienceSchema,
});

export async function assertManualSendEligibility(
  tx: Prisma.TransactionClient,
  eventId: string,
  actorUserId: string,
) {
  const eligibility = await getCommunicationSendEligibility(
    tx,
    eventId,
    actorUserId,
  );

  if (!eligibility.allowed) {
    const message =
      eligibility.reason === "FORBIDDEN"
        ? "Communications are unavailable."
        : eligibility.reason === "ARCHIVED"
          ? "Restore this event before sending a message."
          : "Publish this event before sending a message.";
    throw new ManualCommunicationError(message);
  }

  return eligibility.actor;
}

// Transaction-aware entry point; caller supplies a fresh verified identity.
// No independent transaction, SMTP, or Event lock after admission.
export async function enqueueManualCommunication(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  rawInput: unknown,
) {
  const input = manualSendSchema.parse(rawInput);
  const [isolation] = await tx.$queryRaw<{ level: string }[]>`
    SELECT current_setting('transaction_isolation') AS level`;

  if (isolation.level !== "read committed") {
    throw new Error("Manual enqueue requires ReadCommitted.");
  }

  await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${input.eventId}::uuid FOR UPDATE`;
  const actor = await assertManualSendEligibility(
    tx,
    input.eventId,
    actorUserId,
  );
  // The schema's Event-scoped uniqueness is further namespaced by verified actor.
  const idempotencyKey = `manual:${actorUserId}:${input.requestKey}`;
  const existing = await tx.communication.findUnique({
    where: {
      eventId_idempotencyKey: { eventId: input.eventId, idempotencyKey },
    },
    select: {
      id: true,
      kind: true,
      actorUserId: true,
      contextSnapshot: true,
      requestDigest: true,
      recipientCount: true,
    },
  });
  const contextSnapshot = existing
    ? manualContextSchema.parse(existing.contextSnapshot)
    : manualContextSchema.parse({
        schemaVersion: 1,
        kind: "MANUAL",
        eventTitle: (
          await tx.event.findUniqueOrThrow({
            where: { id: input.eventId },
            select: { title: true },
          })
        ).title,
      });
  // Replays use the original immutable context, never live audience/title/name.
  const requestDigest = createHash("sha256")
    .update(
      JSON.stringify({
        schemaVersion: 1,
        eventId: input.eventId,
        actorUserId,
        audience: input.audience,
        subject: input.subject,
        message: input.message,
        contextSnapshot,
      }),
    )
    .digest("hex");

  if (existing) {
    if (
      existing.kind !== "MANUAL" ||
      existing.actorUserId !== actorUserId ||
      existing.requestDigest !== requestDigest
    ) {
      throw new ManualCommunicationError(
        "This request key was already used for another message. Start a new message.",
      );
    }

    return { id: existing.id, recipientCount: existing.recipientCount };
  }

  const { emails } = await resolveManualAudience(
    tx,
    input.eventId,
    input.audience,
  );

  if (emails.length === 0) {
    throw new ManualCommunicationError(
      "There are no deliverable email addresses in this audience.",
    );
  }

  const actorSnapshot = await captureCommunicationActor(tx, actor);
  let admittedAt: Date;

  try {
    ({ admittedAt } = await checkManualCommunicationAdmission(tx, {
      eventId: input.eventId,
      actorUserId,
      recipientCount: emails.length,
    }));
  } catch (error) {
    if (
      error instanceof Error &&
      [
        "Manual recipient limit exceeded.",
        "Manual sending frequency limit exceeded.",
        "Manual delivery queue limit exceeded.",
      ].includes(error.message)
    ) {
      throw new ManualCommunicationError(
        "The sending or queue limit has been reached. Please try again later.",
      );
    }

    throw error;
  }

  const id = randomUUID();
  const communication = await tx.communication.create({
    data: {
      id,
      eventId: input.eventId,
      kind: "MANUAL",
      audience: input.audience,
      subject: input.subject,
      message: input.message,
      contextSnapshot,
      ...actorSnapshot,
      recipientCount: emails.length,
      idempotencyKey,
      requestDigest,
      createdAt: admittedAt,
      deliveries: {
        createMany: {
          data: emails.map((recipientEmail) => ({
            type: "MANUAL_EVENT_MESSAGE",
            status: "PENDING",
            recipientEmail,
            payload: {},
            deduplicationKey: `manual:${id}:${createHash("sha256").update(recipientEmail).digest("hex")}`,
          })),
        },
      },
    },
    select: { id: true, recipientCount: true },
  });
  await tx.$executeRaw`SELECT pg_notify(${emailOutboxChannel}::text, ''::text)`;
  await notifyEventChanged(tx, input.eventId);

  return communication;
}
