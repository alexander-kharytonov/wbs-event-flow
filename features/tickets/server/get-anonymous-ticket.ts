import "server-only";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
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
      registration: {
        select: {
          attendeeName: true,
          attendeeEmail: true,
          revokedAt: true,
          sourceApplication: {
            select: { eventRevision: { select: { snapshot: true } } },
          },
          event: {
            select: {
              cancelledAt: true,
              cancellationReason: true,
              endsAt: true,
              publishedRevision: { select: { snapshot: true } },
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    return null;
  }

  const event = ticket.registration.event;
  const published = eventSnapshotSchema.safeParse(
    event.publishedRevision?.snapshot,
  );
  const historical = eventSnapshotSchema.safeParse(
    ticket.registration.sourceApplication.eventRevision.snapshot,
  );
  const snapshot = published.success
    ? published.data
    : historical.success
      ? historical.data
      : null;

  return {
    ticket: await presentTicket(
      ticket,
      ticket.registration,
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
