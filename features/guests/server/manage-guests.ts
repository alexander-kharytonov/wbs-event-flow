import "server-only";
import { z } from "zod";
import { applicationInputSchema } from "@/features/events/application-input";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import type { GuestResult } from "@/features/guests/guest-result";
import {
  authorizeParty,
  type PartyActor,
} from "@/features/guests/server/party-authorization";
import { issueTicket } from "@/features/tickets/server/issue-ticket";
import { prisma } from "@/lib/prisma";
import { notifyAttendeesChanged } from "@/lib/realtime/application-notifications";

const guestInput = z.strictObject({
  name: applicationInputSchema.shape.fullName,
  email: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    applicationInputSchema.shape.email
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  ),
});

type Command =
  | { type: "add"; input: unknown }
  | { type: "remove"; guestId: unknown };

async function manageGuest(
  actor: PartyActor,
  command: Command,
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
        const guest =
          command.type === "remove" &&
          z.uuid().safeParse(command.guestId).success
            ? await tx.attendee.findFirst({
                where: {
                  id: command.guestId as string,
                  registrationId: registration.id,
                  kind: "GUEST",
                },
                include: { ticket: true },
              })
            : null;

        if (command.type === "remove" && !guest) {
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

        if (command.type === "remove") {
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
        }

        const parsed = guestInput.safeParse(command.input);

        if (!parsed.success) {
          return { code: "INVALID_INPUT" };
        }

        if (!event.publishedRevisionId) {
          return { code: "NOT_PUBLISHED" };
        }

        const publication = await tx.eventRevision.findFirst({
          where: {
            eventId: event.id,
            id: event.publishedRevisionId,
          },
          select: { snapshot: true },
        });
        const snapshot = eventSnapshotSchema.safeParse(publication?.snapshot);

        if (!snapshot.success) {
          return { code: "NOT_PUBLISHED" };
        }

        if (snapshot.data.maxGuestsPerRegistration === 0) {
          return { code: "GUESTS_NOT_ALLOWED" };
        }

        const activeGuests = await tx.attendee.count({
          where: {
            registrationId: registration.id,
            kind: "GUEST",
            revokedAt: null,
          },
        });

        if (activeGuests >= snapshot.data.maxGuestsPerRegistration) {
          return { code: "GUEST_LIMIT_REACHED" };
        }

        if (snapshot.data.capacity !== null) {
          const occupied = await tx.attendee.count({
            where: { registration: { eventId: event.id }, revokedAt: null },
          });

          if (occupied >= snapshot.data.capacity) {
            return { code: "CAPACITY_REACHED" };
          }
        }

        const added = await tx.attendee.create({
          data: {
            registrationId: registration.id,
            kind: "GUEST",
            userId: null,
            name: parsed.data.name,
            email: parsed.data.email,
            createdAt: event.decisionNow,
          },
        });
        await issueTicket(tx, added);
        await notifyAttendeesChanged(tx, {
          eventId: event.id,
          userId: registration.userId,
        });

        return { code: "ADDED" };
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch {
    return { code: "FAILED" };
  }
}

export async function addGuest(actor: PartyActor, input: unknown) {
  return manageGuest(actor, { type: "add", input });
}

export async function removeGuest(actor: PartyActor, guestId: unknown) {
  return manageGuest(actor, { type: "remove", guestId });
}
