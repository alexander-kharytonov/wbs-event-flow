import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

export function registrationAvailability(
  snapshot: Pick<EventSnapshot, "registrationOpensAt" | "registrationClosesAt">,
  now: Date,
): "NOT_OPEN_YET" | "OPEN" | "CLOSED" {
  const instant = now.getTime();

  if (
    snapshot.registrationClosesAt &&
    instant >= Date.parse(snapshot.registrationClosesAt)
  ) {
    return "CLOSED";
  }

  if (
    snapshot.registrationOpensAt &&
    instant < Date.parse(snapshot.registrationOpensAt)
  ) {
    return "NOT_OPEN_YET";
  }

  return "OPEN";
}
