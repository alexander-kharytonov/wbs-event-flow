import "server-only";
import {
  actorSnapshotSchema,
  communicationContextSchema,
} from "@/features/communications/server/contracts";
import type { EmailOutboxStatus, Prisma } from "@/generated/prisma/client";

// Selection/projection primitives, not unauthenticated query endpoints. Future
// History/Details reads must first authorize communications.read on the Event.
export const communicationSummarySelect = {
  id: true,
  eventId: true,
  kind: true,
  trigger: true,
  createdAt: true,
  actorNameSnapshot: true,
  actorRoleSnapshot: true,
  audience: true,
  subject: true,
  recipientCount: true,
} satisfies Prisma.CommunicationSelect;

export type CommunicationSummary = Prisma.CommunicationGetPayload<{
  select: typeof communicationSummarySelect;
}>;

export const safeRecipientStatusSelect = {
  id: true,
  recipientEmail: true,
  status: true,
  sentAt: true,
} satisfies Prisma.EmailOutboxSelect;

export type SafeRecipientStatus = Prisma.EmailOutboxGetPayload<{
  select: typeof safeRecipientStatusSelect;
}>;

export const deliveryStatusMeaning = {
  PENDING: "Queued / awaiting attempt",
  PROCESSING: "Currently claimed",
  SENT: "SMTP transport accepted",
  FAILED: "Automatic attempts exhausted",
} as const satisfies Record<EmailOutboxStatus, string>;

export type DeliveryCounts = Record<EmailOutboxStatus, number>;

export function projectDeliveryCounts(
  rows: readonly { status: EmailOutboxStatus; count: number }[],
): DeliveryCounts {
  const counts: DeliveryCounts = {
    PENDING: 0,
    PROCESSING: 0,
    SENT: 0,
    FAILED: 0,
  };

  for (const row of rows) {
    counts[row.status] += row.count;
  }

  return counts;
}

export function projectSafeRecipientStatus(
  row: SafeRecipientStatus,
): SafeRecipientStatus {
  return {
    id: row.id,
    recipientEmail: row.recipientEmail,
    status: row.status,
    sentAt: row.sentAt,
  };
}

export function projectCommunicationActor(row: {
  actorNameSnapshot: string | null;
  actorRoleSnapshot: "OWNER" | "MANAGER" | "RECEPTION" | null;
}) {
  const actor = actorSnapshotSchema.parse({
    actorUserId: null,
    actorNameSnapshot: row.actorNameSnapshot,
    actorRoleSnapshot: row.actorRoleSnapshot,
  });

  return { name: actor.actorNameSnapshot, role: actor.actorRoleSnapshot };
}

export function projectCommunicationContext(snapshot: unknown) {
  return communicationContextSchema.parse(snapshot);
}
