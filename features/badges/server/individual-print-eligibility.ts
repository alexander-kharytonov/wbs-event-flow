import "server-only";
import {
  type EventRole,
  hasEventPermission,
} from "@/features/events/server/event-access";

// Current-state eligibility only. Callers must authorize the actor and load
// authoritative records; operational targets remain non-authoritative hints.
export function canPrintIndividualBadge(
  role: EventRole,
  event: { id: string; cancelledAt: Date | null },
  attendee: {
    revokedAt: Date | null;
    registration: { eventId: string; revokedAt: Date | null };
  },
) {
  return (
    hasEventPermission(role, "badges.print.individual") &&
    attendee.registration.eventId === event.id &&
    !event.cancelledAt &&
    !attendee.revokedAt &&
    !attendee.registration.revokedAt
  );
}
