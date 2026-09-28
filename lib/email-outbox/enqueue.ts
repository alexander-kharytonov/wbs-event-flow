import "server-only";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";
import type { EmailOutboxType, Prisma } from "@/generated/prisma/client";
import { emailPayloadSchemas } from "@/lib/email-outbox/payload";

export const emailOutboxChannel = "event_flow_email_outbox";

export function emailEventSnapshot(snapshot: EventSnapshot, publicId: string) {
  return {
    title: snapshot.title,
    startsAt: snapshot.startsAt,
    endsAt: snapshot.endsAt,
    timezone: snapshot.timezone,
    publicId,
  };
}

export async function enqueueApplicationEmail(
  tx: Prisma.TransactionClient,
  input: {
    applicationId: string;
    type: EmailOutboxType;
    recipientEmail: string;
    payload: unknown;
  },
) {
  const payload = emailPayloadSchemas[input.type].parse(input.payload);
  await tx.emailOutbox.create({
    data: {
      type: input.type,
      deduplicationKey: `${input.applicationId}:${input.type}`,
      recipientEmail: input.recipientEmail,
      payload,
    },
  });
  // Commit publishes the wake-up; the durable row survives a lost notification.
  await tx.$executeRaw`SELECT pg_notify(${emailOutboxChannel}::text, ''::text)`;
}
