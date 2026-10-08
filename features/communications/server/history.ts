import "server-only";
import {
  actorSnapshotSchema,
  communicationContextSchema,
} from "@/features/communications/server/contracts";
import type { EmailOutboxStatus, Prisma } from "@/generated/prisma/client";

// Selection/projection primitives, not unauthenticated query endpoints.
// History/Details queries first authorize communications.read on the Event.
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
  attempts: true,
  createdAt: true,
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
    attempts: row.attempts,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
  };
}

export function communicationDeliverySummary(
  recipientCount: number,
  counts: DeliveryCounts,
): {
  label: string;
  color: "default" | "info" | "success" | "warning" | "error";
} {
  const values = [
    counts.PENDING,
    counts.PROCESSING,
    counts.SENT,
    counts.FAILED,
  ];
  const total = values.reduce((sum, count) => sum + count, 0);

  if (
    !Number.isSafeInteger(recipientCount) ||
    recipientCount < 0 ||
    values.some((count) => !Number.isSafeInteger(count) || count < 0) ||
    total !== recipientCount
  ) {
    return { label: "Status unavailable", color: "default" };
  }

  if (recipientCount === 0) {
    return { label: "No recipients", color: "default" };
  }

  if (counts.SENT === recipientCount) {
    return { label: "Sent", color: "success" };
  }

  if (counts.FAILED === recipientCount) {
    return { label: "Failed", color: "error" };
  }

  if (counts.FAILED > 0) {
    return {
      label:
        counts.PENDING + counts.PROCESSING > 0
          ? "In progress · partial failures"
          : "Completed with failures",
      color: "warning",
    };
  }

  if (counts.PENDING === recipientCount) {
    return { label: "Pending", color: "default" };
  }

  return { label: "In progress", color: "info" };
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
