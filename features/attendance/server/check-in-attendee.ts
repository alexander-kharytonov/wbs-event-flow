import "server-only";
import type { CheckInDecision } from "@/features/attendance/check-in-result";
import type { Event, Prisma } from "@/generated/prisma/client";
import { notifyAttendanceChanged } from "@/lib/realtime/application-notifications";

type Admission = {
  id: string;
  revokedAt: Date | null;
  attendance: { checkedInAt: Date } | null;
  registration: {
    eventId: string;
    userId: string | null;
    revokedAt: Date | null;
  };
};

type Provenance =
  | { method: "QR"; ticketId: string; revokedAt: Date | null }
  | { method: "MANUAL"; ticketId: null };

// The caller authorizes the actor, locks Event and rereads admission in this
// transaction. Ownership policy stays outside this shared domain operation.
export async function checkInAttendee(
  tx: Prisma.TransactionClient,
  event: Pick<Event, "id" | "startsAt" | "endsAt" | "cancelledAt"> & {
    decisionNow: Date;
  },
  actor: { userId: string },
  attendee: Admission,
  provenance: Provenance,
): Promise<CheckInDecision> {
  if (attendee.registration.eventId !== event.id) {
    throw new Error("Check-in admission does not belong to locked Event.");
  }

  if (attendee.attendance) {
    return {
      code: "ALREADY_CHECKED_IN",
      checkedInAt: attendee.attendance.checkedInAt.toISOString(),
    };
  }

  if (event.cancelledAt) {
    return { code: "EVENT_CANCELLED" };
  }

  if (event.decisionNow < event.startsAt) {
    return {
      code: "CHECK_IN_NOT_OPEN",
      boundaryAt: event.startsAt.toISOString(),
    };
  }

  if (event.decisionNow >= event.endsAt) {
    return { code: "CHECK_IN_CLOSED", boundaryAt: event.endsAt.toISOString() };
  }

  if (
    attendee.registration.revokedAt ||
    attendee.revokedAt ||
    (provenance.method === "QR" && provenance.revokedAt)
  ) {
    return { code: "ADMISSION_REVOKED" };
  }

  await tx.attendance.create({
    data: {
      attendeeId: attendee.id,
      ticketId: provenance.ticketId,
      method: provenance.method,
      checkedInAt: event.decisionNow,
      checkedInByUserId: actor.userId,
    },
  });
  await notifyAttendanceChanged(tx, {
    eventId: event.id,
    userId: attendee.registration.userId,
  });

  return { code: "CHECKED_IN", checkedInAt: event.decisionNow.toISOString() };
}
