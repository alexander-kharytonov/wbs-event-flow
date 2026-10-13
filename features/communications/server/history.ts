import "server-only";
import type { DeliveryCounts } from "@/features/communications/delivery-status";
import { communicationContextSchema } from "@/features/communications/server/contracts";
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

export const safeRecipientStatusSelect = {
  id: true,
  recipientEmail: true,
  status: true,
  attempts: true,
  createdAt: true,
  sentAt: true,
} satisfies Prisma.EmailOutboxSelect;

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

export function projectCommunicationContext(snapshot: unknown) {
  return communicationContextSchema.parse(snapshot);
}
