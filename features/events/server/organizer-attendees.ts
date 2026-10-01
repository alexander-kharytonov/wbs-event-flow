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
          publishedAt: true,
          publishedRevisionId: true,
          _count: { select: { applications: true, revisions: true } },
        },
      });

      if (!event) {
        return null;
      }

      // Load relation branches sequentially on this transaction's connection.
      const publishedRevision = event.publishedRevisionId
        ? await tx.eventRevision.findUnique({
            where: { id: event.publishedRevisionId },
            select: { contentVersion: true, number: true, snapshot: true },
          })
        : null;
      const people = await tx.attendee.findMany({
        where: { registration: { eventId } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          kind: true,
          registrationId: true,
          registration: {
            select: {
              revokedAt: true,
              attendees: { where: { kind: "PRIMARY" }, select: { name: true } },
            },
          },
          name: true,
          email: true,
          createdAt: true,
          revokedAt: true,
        },
      });
      const attendeeIds = people.map(({ id }) => id);
      const tickets = await tx.ticket.findMany({
        where: { attendeeId: { in: attendeeIds } },
        select: { attendeeId: true, number: true, revokedAt: true },
      });
      const attendances = await tx.attendance.findMany({
        where: { attendeeId: { in: attendeeIds } },
        select: {
          attendeeId: true,
          checkedInAt: true,
          method: true,
          checkedInByUser: { select: { name: true } },
        },
      });
      const ticketsByAttendee = new Map(
        tickets.map(({ attendeeId, ...ticket }) => [attendeeId, ticket]),
      );
      const attendanceByAttendee = new Map(
        attendances.map(({ attendeeId, ...attendance }) => [
          attendeeId,
          attendance,
        ]),
      );
      const attendees = people.map((person) => ({
        ...person,
        ticket: ticketsByAttendee.get(person.id) ?? null,
        attendance: attendanceByAttendee.get(person.id) ?? null,
      }));
      const { publishedRevisionId: _publishedRevisionId, ...eventDetails } =
        event;

      return { event: { ...eventDetails, publishedRevision }, attendees };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export type OrganizerAttendee = NonNullable<
  Awaited<ReturnType<typeof getOwnedAttendees>>
>["attendees"][number];
