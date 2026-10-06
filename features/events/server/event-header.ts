import "server-only";
import {
  authorizeEventActor,
  hasEventPermission,
} from "@/features/events/server/event-access";
import { getOperationalEvent } from "@/features/events/server/event-context";
import type { Prisma } from "@/generated/prisma/client";

// Shared by the standalone header and Overview's single consistent snapshot.
export async function readEventHeader(
  tx: Prisma.TransactionClient,
  eventId: string,
  userId: string,
) {
  const access = await authorizeEventActor(
    tx,
    eventId,
    userId,
    "event.context.read",
  );

  if (!access) {
    return null;
  }

  const context = await getOperationalEvent(tx, eventId);
  const attendeeCount = await tx.attendee.count({
    where: { revokedAt: null, registration: { eventId, revokedAt: null } },
  });
  const applicationCount = hasEventPermission(access.role, "applications.read")
    ? await tx.application.count({ where: { eventId } })
    : undefined;
  const ownerEvent = hasEventPermission(access.role, "event.edit")
    ? await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          startsAt: true,
          endsAt: true,
          cancelledAt: true,
          archivedAt: true,
          cancellationReason: true,
          title: true,
          contentVersion: true,
          publicId: true,
          publishedAt: true,
          _count: { select: { revisions: true } },
          publishedRevision: {
            select: { contentVersion: true, number: true, snapshot: true },
          },
        },
      })
    : null;
  const published =
    hasEventPermission(access.role, "attendees.read.full") && !ownerEvent
      ? await tx.event.findUniqueOrThrow({
          where: { id: eventId },
          select: { publishedRevision: { select: { snapshot: true } } },
        })
      : null;

  return {
    access,
    context,
    attendeeCount,
    applicationCount,
    ownerEvent,
    published,
  };
}

export type EventHeaderProjection = NonNullable<
  Awaited<ReturnType<typeof readEventHeader>>
>;
