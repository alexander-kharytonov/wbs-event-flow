import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function getOwnedAttendees(organizerId: string, eventId: string) {
  if (!z.uuid().safeParse(eventId).success) {
    return null;
  }

  return prisma.$transaction(
    async (tx) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, organizerId },
        select: {
          title: true,
          startsAt: true,
          endsAt: true,
          timezone: true,
          cancelledAt: true,
          cancellationReason: true,
          archivedAt: true,
          contentVersion: true,
          publicId: true,
          publishedRevision: { select: { contentVersion: true, number: true } },
          _count: { select: { applications: true } },
        },
      });

      if (!event) {
        return null;
      }

      const attendees = await tx.attendee.findMany({
        where: { registration: { eventId } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          revokedAt: true,
          attendance: { select: { checkedInAt: true } },
        },
      });

      return { event, attendees };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
