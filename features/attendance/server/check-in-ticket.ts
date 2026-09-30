import "server-only";
import { z } from "zod";
import type { CheckInResult } from "@/features/attendance/check-in-result";
import { parseTicketQr } from "@/features/attendance/server/parse-ticket-qr";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { prisma } from "@/lib/prisma";
import { notifyAttendanceChanged } from "@/lib/realtime/application-notifications";
import { hashTicketSecret } from "@/lib/ticket-crypto";

const inputSchema = z.strictObject({
  eventId: z.uuid(),
  qrPayload: z.unknown(),
});

// Actor IDs are supplied only by the verified-session action adapter.
export async function checkInTicket(
  actor: { userId: string; organizerId: string },
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
          organizerId: actor.organizerId,
        });

        if (!event) {
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
                name: true,
                email: true,
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
          attendeeName: ticket.attendee.name,
          attendeeEmail: ticket.attendee.email,
          ticketNumber: ticket.number,
        };

        if (ticket.attendee.attendance) {
          return {
            code: "ALREADY_CHECKED_IN",
            attendee,
            checkedInAt: ticket.attendee.attendance.checkedInAt.toISOString(),
          };
        }

        if (event.cancelledAt) {
          return { code: "EVENT_CANCELLED", attendee };
        }

        if (event.decisionNow < event.startsAt) {
          return {
            code: "CHECK_IN_NOT_OPEN",
            attendee,
            boundaryAt: event.startsAt.toISOString(),
          };
        }

        if (event.decisionNow >= event.endsAt) {
          return {
            code: "CHECK_IN_CLOSED",
            attendee,
            boundaryAt: event.endsAt.toISOString(),
          };
        }

        if (
          registration.revokedAt ||
          ticket.attendee.revokedAt ||
          ticket.revokedAt
        ) {
          return { code: "ADMISSION_REVOKED", attendee };
        }

        await tx.attendance.create({
          data: {
            attendeeId: ticket.attendee.id,
            ticketId: ticket.id,
            checkedInAt: event.decisionNow,
            checkedInByUserId: actor.userId,
            method: "QR",
          },
        });
        await notifyAttendanceChanged(tx, {
          eventId: event.id,
          userId: registration.userId,
        });

        return {
          code: "CHECKED_IN",
          attendee,
          checkedInAt: event.decisionNow.toISOString(),
        };
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
