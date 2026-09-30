import "server-only";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import {
  partyAttendeeSelect,
  presentPartyGuests,
} from "@/features/guests/server/party-presentation";
import {
  presentTicket,
  ticketDisplaySelect,
} from "@/features/tickets/server/ticket-display";
import { prisma } from "@/lib/prisma";
import { hashTicketSecret, isTicketSecret } from "@/lib/ticket-crypto";

export async function getAnonymousTicket(access: string) {
  if (!isTicketSecret(access)) {
    return null;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { anonymousAccessHash: hashTicketSecret(access) },
    select: {
      ...ticketDisplaySelect,
      attendee: {
        select: {
          kind: true,
          name: true,
          email: true,
          revokedAt: true,
          attendance: { select: { checkedInAt: true } },
          registration: {
            select: {
              revokedAt: true,
              attendees: {
                select: partyAttendeeSelect,
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              },
              sourceApplication: {
                select: { eventRevision: { select: { snapshot: true } } },
              },
              event: {
                select: {
                  cancelledAt: true,
                  cancellationReason: true,
                  startsAt: true,
                  endsAt: true,
                  publishedRevision: { select: { snapshot: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (ticket?.attendee.kind !== "PRIMARY") {
    return null;
  }

  const event = ticket.attendee.registration.event;
  const published = eventSnapshotSchema.safeParse(
    event.publishedRevision?.snapshot,
  );
  const historical = eventSnapshotSchema.safeParse(
    ticket.attendee.registration.sourceApplication.eventRevision.snapshot,
  );
  const snapshot = published.success
    ? published.data
    : historical.success
      ? historical.data
      : null;

  return {
    guests: await presentPartyGuests(
      ticket.attendee.registration,
      event,
      snapshot
        ? {
            title: snapshot.title,
            startsAt: snapshot.startsAt,
            endsAt: snapshot.endsAt,
            timezone: snapshot.timezone,
          }
        : null,
    ),
    ticket: await presentTicket(
      ticket,
      {
        ...ticket.attendee,
        revokedAt:
          ticket.attendee.registration.revokedAt ?? ticket.attendee.revokedAt,
      },
      snapshot
        ? {
            title: snapshot.title,
            startsAt: snapshot.startsAt,
            endsAt: snapshot.endsAt,
            timezone: snapshot.timezone,
          }
        : null,
      event.cancelledAt,
      event.endsAt.getTime() <= Date.now(),
    ),
    cancelledAt: event.cancelledAt,
    cancellationReason: event.cancellationReason,
  };
}
