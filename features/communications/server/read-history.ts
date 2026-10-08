import "server-only";
import { z } from "zod";
import { getCommunicationSendEligibility } from "@/features/communications/server/eligibility";
import {
  communicationSummarySelect,
  projectDeliveryCounts,
} from "@/features/communications/server/history";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { readEventHeader } from "@/features/events/server/event-header";
import type { CommunicationKind, Prisma } from "@/generated/prisma/client";

// Transaction primitive; the request reader in read.ts supplies verified identity.
export async function queryCommunicationHistory(
  tx: Prisma.TransactionClient,
  eventId: string,
  actorUserId: string,
  before?: string,
  filters: { subject?: string; kind?: CommunicationKind } = {},
) {
  const access = await authorizeEventActor(
    tx,
    eventId,
    actorUserId,
    "communications.read",
  );

  if (!access) {
    return null;
  }

  const cursor =
    before && z.uuid().safeParse(before).success
      ? await tx.communication.findFirst({
          where: { id: before, eventId },
          select: { id: true, createdAt: true },
        })
      : null;

  if (before !== undefined && !cursor) {
    return null;
  }

  const summaries = await tx.communication.findMany({
    where: {
      eventId,
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.subject
        ? {
            subject: {
              contains: filters.subject.replace(/[\\%_]/g, "\\$&"),
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    select: communicationSummarySelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 21,
  });
  const visible = summaries.slice(0, 20);
  const counts = visible.length
    ? await tx.emailOutbox.groupBy({
        by: ["communicationId", "status"],
        where: { communicationId: { in: visible.map((row) => row.id) } },
        _count: { _all: true },
      })
    : [];
  const items = visible.map((row) => ({
    ...row,
    deliveryCounts: projectDeliveryCounts(
      counts
        .filter((count) => count.communicationId === row.id)
        .map((count) => ({ status: count.status, count: count._count._all })),
    ),
  }));

  return {
    header: await readEventHeader(tx, eventId, actorUserId),
    eligibility: await getCommunicationSendEligibility(
      tx,
      eventId,
      actorUserId,
    ),
    items,
    nextCursor: summaries.length > 20 ? visible.at(-1)?.id : undefined,
    hasCursor: Boolean(cursor),
  };
}
