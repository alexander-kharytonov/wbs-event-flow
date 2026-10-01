import "server-only";
import { z } from "zod";
import type { ManualCheckInResult } from "@/features/attendance/check-in-result";
import { checkInAttendee } from "@/features/attendance/server/check-in-attendee";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { prisma } from "@/lib/prisma";

const inputSchema = z.strictObject({ eventId: z.uuid(), attendeeId: z.uuid() });
const unavailable = {
  code: "UNAVAILABLE" as const,
  message: "This check-in request is unavailable.",
};

// Actor IDs come exclusively from the verified-session action adapter.
export async function checkInManually(
  actor: { userId: string },
  input: unknown,
): Promise<ManualCheckInResult> {
  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return unavailable;
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const event = await lockEventForUpdate(tx, {
          id: parsed.data.eventId,
        });

        const access =
          event &&
          (await authorizeEventActor(
            tx,
            event.id,
            actor.userId,
            "checkIn.manual",
          ));

        if (!event || !access) {
          return unavailable;
        }

        const attendee = await tx.attendee.findUnique({
          where: { id: parsed.data.attendeeId },
          select: {
            id: true,
            revokedAt: true,
            attendance: { select: { checkedInAt: true } },
            registration: {
              select: { eventId: true, userId: true, revokedAt: true },
            },
          },
        });

        if (!attendee || attendee.registration.eventId !== event.id) {
          return unavailable;
        }

        return checkInAttendee(tx, event, actor, attendee, {
          method: "MANUAL",
          ticketId: null,
        });
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch {
    return {
      code: "FAILED",
      message: "Could not check in this attendee. Please try again.",
    };
  }
}
