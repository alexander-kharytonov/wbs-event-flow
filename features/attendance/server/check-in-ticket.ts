import "server-only";
import { z } from "zod";
import type { CheckInResult } from "@/features/attendance/check-in-result";
import { checkInAttendee } from "@/features/attendance/server/check-in-attendee";
import { parseTicketQr } from "@/features/attendance/server/parse-ticket-qr";
import {
  authorizeEventActor,
  hasEventPermission,
} from "@/features/events/server/event-access";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { prisma } from "@/lib/prisma";
import { hashTicketSecret } from "@/lib/ticket-crypto";

const inputSchema = z.strictObject({
  eventId: z.uuid(),
  qrPayload: z.unknown(),
});

// Actor IDs are supplied only by the verified-session action adapter.
export async function checkInTicket(
  actor: { userId: string },
  input: unknown,
): Promise<CheckInResult> {
  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      code: "UNAVAILABLE",
      message: "This check-in request is unavailable.",
    };
  }

  const credential = parseTicketQr(parsed.data.qrPayload);

  if (!credential) {
    return { code: "INVALID_CREDENTIAL" };
  }

  const credentialHash = hashTicketSecret(credential);

  try {
    const candidate = await prisma.ticket.findUnique({
      where: { credentialHash },
      select: { id: true },
    });

    if (!candidate) {
      return { code: "INVALID_CREDENTIAL" };
    }

    return await prisma.$transaction(
      async (tx): Promise<CheckInResult> => {
        const event = await lockEventForUpdate(tx, {
          id: parsed.data.eventId,
        });

        const access =
          event &&
          (await authorizeEventActor(tx, event.id, actor.userId, "checkIn.qr"));

        if (!event || !access) {
          return { code: "UNAVAILABLE", message: "This event is unavailable." };
        }

        // Candidate data never authorizes a write. Reread after the shared lock.
        const ticket = await tx.ticket.findUnique({
          where: { credentialHash },
          select: {
            id: true,
            number: true,
            revokedAt: true,
            attendee: {
              select: {
                id: true,
                kind: true,
                name: true,
                ...(hasEventPermission(access.role, "attendees.read.full")
                  ? { email: true }
                  : {}),
                revokedAt: true,
                attendance: { select: { checkedInAt: true } },
                registration: {
                  select: { eventId: true, userId: true, revokedAt: true },
                },
              },
            },
          },
        });

        if (!ticket) {
          return { code: "INVALID_CREDENTIAL" };
        }

        const registration = ticket.attendee.registration;

        if (registration.eventId !== event.id) {
          return { code: "WRONG_EVENT" };
        }

        const attendee = {
          kind: ticket.attendee.kind,
          attendeeName: ticket.attendee.name,
          ...(hasEventPermission(access.role, "attendees.read.full")
            ? { attendeeEmail: ticket.attendee.email }
            : {}),
          ticketNumber: ticket.number,
        };

        const decision = await checkInAttendee(
          tx,
          event,
          actor,
          ticket.attendee,
          {
            method: "QR",
            ticketId: ticket.id,
            revokedAt: ticket.revokedAt,
          },
        );

        const showIdentity =
          hasEventPermission(access.role, "attendees.read.full") ||
          (!ticket.attendee.revokedAt && !registration.revokedAt);

        return { ...decision, ...(showIdentity ? { attendee } : {}) };
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch {
    // Never serialize database errors or scanner input into a response or log.
    return {
      code: "FAILED",
      message: "Could not check in this ticket. Please try again.",
    };
  }
}
