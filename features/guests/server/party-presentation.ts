import "server-only";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import {
  presentTicket,
  type TicketPresentation,
  ticketDisplaySelect,
} from "@/features/tickets/server/ticket-display";
import type { Prisma } from "@/generated/prisma/client";

export const partyAttendeeSelect = {
  id: true,
  kind: true,
  name: true,
  email: true,
  revokedAt: true,
  ticket: { select: ticketDisplaySelect },
  attendance: { select: { checkedInAt: true } },
} satisfies Prisma.AttendeeSelect;

type Person = Prisma.AttendeeGetPayload<{ select: typeof partyAttendeeSelect }>;

export async function presentPartyGuests(
  registration: { revokedAt: Date | null; attendees: Person[] },
  event: {
    startsAt: Date;
    endsAt: Date;
    cancelledAt: Date | null;
    publishedRevision: { snapshot: unknown } | null;
  },
  context: TicketPresentation["context"],
) {
  const published = eventSnapshotSchema.safeParse(
    event.publishedRevision?.snapshot,
  );
  const limit = published.success ? published.data.maxGuestsPerRegistration : 0;
  const guests = registration.attendees.filter(({ kind }) => kind === "GUEST");
  const activeCount = guests.filter(({ revokedAt }) => !revokedAt).length;
  const frozen = Date.now() >= event.startsAt.getTime();
  const canRemove = !registration.revokedAt && !event.cancelledAt && !frozen;
  const reason = registration.revokedAt
    ? "This registration has been revoked."
    : event.cancelledAt
      ? "This event has been cancelled."
      : frozen
        ? "Guest management closed when the event started."
        : !published.success
          ? "This event is unpublished. You can still remove guests before it starts."
          : limit === 0
            ? "Guests are not currently allowed. You can still remove existing guests before the event starts."
            : null;
  const items = await Promise.all(
    guests.map(async (guest) => {
      if (!guest.ticket) {
        throw new Error("Guest Ticket correspondence failed.");
      }

      return {
        id: guest.id,
        active: guest.revokedAt === null,
        ticket: await presentTicket(
          guest.ticket,
          {
            ...guest,
            revokedAt: registration.revokedAt ?? guest.revokedAt,
          },
          context,
          event.cancelledAt,
          Date.now() >= event.endsAt.getTime(),
        ),
      };
    }),
  );

  return {
    items,
    activeCount,
    limit,
    reason,
    canRemove,
    canAdd: canRemove && published.success && activeCount < limit,
  };
}

export type PartyGuestsPresentation = Awaited<
  ReturnType<typeof presentPartyGuests>
>;
