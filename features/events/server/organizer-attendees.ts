import "server-only";
import { z } from "zod";
import {
  authorizeEventActor,
  hasEventPermission,
} from "@/features/events/server/event-access";
import { getOperationalEvent } from "@/features/events/server/event-context";
import { prisma } from "@/lib/prisma";

export async function getEventAttendees(userId: string, eventId: string) {
  if (!z.uuid().safeParse(eventId).success) {
    return null;
  }

  return prisma.$transaction(
    async (tx) => {
      const access = await authorizeEventActor(
        tx,
        eventId,
        userId,
        "attendees.read.reception",
      );

      if (!access) {
        return null;
      }

      if (!hasEventPermission(access.role, "attendees.read.full")) {
        const event = await getOperationalEvent(tx, eventId);
        const people = await tx.attendee.findMany({
          where: {
            revokedAt: null,
            registration: { eventId, revokedAt: null },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, name: true, kind: true, registrationId: true },
        });
        const ids = people.map(({ id }) => id);
        const primaries = await tx.attendee.findMany({
          where: {
            registrationId: {
              in: people.map(({ registrationId }) => registrationId),
            },
            kind: "PRIMARY",
          },
          select: { registrationId: true, name: true },
        });
        const tickets = await tx.ticket.findMany({
          where: { attendeeId: { in: ids } },
          select: { attendeeId: true, number: true },
        });
        const attendances = await tx.attendance.findMany({
          where: { attendeeId: { in: ids } },
          select: { attendeeId: true, checkedInAt: true, method: true },
        });
        const names = new Map(
          primaries.map((person) => [person.registrationId, person.name]),
        );
        const ticketById = new Map(
          tickets.map(({ attendeeId, number }) => [attendeeId, { number }]),
        );
        const attendanceById = new Map(
          attendances.map(({ attendeeId, ...attendance }) => [
            attendeeId,
            attendance,
          ]),
        );
        const attendees = people.map((person) => ({
          ...person,
          registration: {
            attendees: names.has(person.registrationId)
              ? [{ name: names.get(person.registrationId) as string }]
              : [],
          },
          ticket: ticketById.get(person.id) ?? null,
          attendance: attendanceById.get(person.id) ?? null,
        }));

        return { event, attendees, full: false };
      }

      const event = await tx.event.findFirst({
        where: { id: eventId },
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

      return {
        event: { ...eventDetails, publishedRevision },
        attendees,
        full: true,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export type OrganizerAttendee = {
  id: string;
  name: string;
  kind: "PRIMARY" | "GUEST";
  registrationId: string;
  email?: string | null;
  createdAt?: Date;
  revokedAt?: Date | null;
  registration: { revokedAt?: Date | null; attendees: { name: string }[] };
  ticket: { number: string; revokedAt?: Date | null } | null;
  attendance: {
    checkedInAt: Date;
    method: "QR" | "MANUAL";
    checkedInByUser?: { name: string } | null;
  } | null;
};
