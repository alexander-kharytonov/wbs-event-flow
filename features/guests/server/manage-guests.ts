import "server-only";
import { z } from "zod";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import type { GuestResult } from "@/features/guests/guest-result";
import {
  authorizeParty,
  type PartyActor,
} from "@/features/guests/server/party-authorization";
import { prisma } from "@/lib/prisma";
import { notifyAttendeesChanged } from "@/lib/realtime/application-notifications";

export async function removeGuest(
  actor: PartyActor,
  guestId: unknown,
): Promise<GuestResult> {
  try {
    const candidate = await authorizeParty(prisma, actor);

    if (!candidate) {
      return { code: "UNAVAILABLE" };
    }

    return await prisma.$transaction(
      async (tx): Promise<GuestResult> => {
        const event = await lockEventForUpdate(tx, { id: candidate.eventId });
        const authorized = await authorizeParty(tx, actor);

        if (
          !event ||
          !authorized ||
          authorized.id !== candidate.id ||
          authorized.eventId !== event.id
        ) {
          return { code: "UNAVAILABLE" };
        }

        const registration = await tx.registration.findUniqueOrThrow({
          where: { id: authorized.id },
          include: {
            attendees: {
              where: { kind: "PRIMARY" },
              include: { ticket: true },
            },
          },
        });
        const primary = registration.attendees[0];

        if (registration.attendees.length !== 1 || !primary?.ticket) {
          throw new Error("Party PRIMARY correspondence failed.");
        }

        // Resolve the target before reporting any domain state for a removal.
        const guest = z.uuid().safeParse(guestId).success
          ? await tx.attendee.findFirst({
              where: {
                id: guestId as string,
                registrationId: registration.id,
                kind: "GUEST",
              },
              include: { ticket: true },
            })
          : null;

        if (!guest) {
          return { code: "UNAVAILABLE" };
        }

        if (registration.revokedAt) {
          return { code: "REGISTRATION_REVOKED" };
        }

        if (primary.revokedAt || primary.ticket.revokedAt) {
          throw new Error("Active party PRIMARY is revoked.");
        }

        if (event.cancelledAt) {
          return { code: "EVENT_CANCELLED" };
        }

        if (event.decisionNow >= event.startsAt) {
          return { code: "PARTY_FROZEN" };
        }

        if (
          !guest?.ticket ||
          guest.revokedAt?.getTime() !== guest.ticket.revokedAt?.getTime()
        ) {
          throw new Error("Guest Ticket revocation correspondence failed.");
        }

        if (guest.revokedAt) {
          return { code: "ALREADY_REMOVED" };
        }

        await tx.attendee.update({
          where: { id: guest.id },
          data: { revokedAt: event.decisionNow },
        });
        await tx.ticket.update({
          where: { attendeeId: guest.id },
          data: { revokedAt: event.decisionNow },
        });
        await notifyAttendeesChanged(tx, {
          eventId: event.id,
          userId: registration.userId,
        });

        return { code: "REMOVED" };
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch {
    return { code: "FAILED" };
  }
}
