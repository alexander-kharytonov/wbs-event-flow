import "server-only";
import { z } from "zod";
import {
  communicationSummarySelect,
  projectCommunicationContext,
  projectDeliveryCounts,
  safeRecipientStatusSelect,
} from "@/features/communications/server/history";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { readEventHeader } from "@/features/events/server/event-header";
import type { Prisma } from "@/generated/prisma/client";

// Transaction primitive; never accepts identity from browser input.
export async function queryCommunicationDetails(
  tx: Prisma.TransactionClient,
  eventId: string,
  actorUserId: string,
  communicationId: string,
  after?: string,
) {
  const access = await authorizeEventActor(
    tx,
    eventId,
    actorUserId,
    "communications.read",
  );

  if (!access || !z.uuid().safeParse(communicationId).success) {
    return null;
  }

  const communication = await tx.communication.findFirst({
    where: { id: communicationId, eventId },
    select: {
      ...communicationSummarySelect,
      message: true,
      contextSnapshot: true,
    },
  });

  if (!communication) {
    return null;
  }

  const cursor =
    after && z.uuid().safeParse(after).success
      ? await tx.emailOutbox.findFirst({
          where: { id: after, communicationId, communication: { eventId } },
          select: { recipientEmail: true },
        })
      : null;

  if (after !== undefined && !cursor) {
    return null;
  }

  // Immutable, unique within Communication; supported by the existing
  // (communicationId, recipientEmail) index. Status changes cannot move rows.
  const rows = await tx.emailOutbox.findMany({
    where: {
      communicationId,
      communication: { eventId },
      ...(cursor ? { recipientEmail: { gt: cursor.recipientEmail } } : {}),
    },
    select: safeRecipientStatusSelect,
    orderBy: { recipientEmail: "asc" },
    take: 51,
  });
  const counts = await tx.emailOutbox.groupBy({
    by: ["status"],
    where: { communicationId, communication: { eventId } },
    _count: { _all: true },
  });
  const { contextSnapshot, message, ...summary } = communication;
  const recipients = rows.slice(0, 50);

  return {
    header: await readEventHeader(tx, eventId, actorUserId),
    communication: {
      ...summary,
      message: communication.kind === "MANUAL" ? message : null,
      context: projectCommunicationContext(contextSnapshot),
      deliveryCounts: projectDeliveryCounts(
        counts.map((row) => ({ status: row.status, count: row._count._all })),
      ),
    },
    recipients,
    hasCursor: Boolean(cursor),
    nextCursor: rows.length > 50 ? recipients.at(-1)?.id : undefined,
  };
}
