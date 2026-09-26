import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

// Historical revisions may contain a later deadline; the event end always wins.
export function registrationDeadline(
  snapshot: Pick<EventSnapshot, "endsAt" | "registrationClosesAt">,
): string {
  if (
    snapshot.registrationClosesAt &&
    Date.parse(snapshot.registrationClosesAt) < Date.parse(snapshot.endsAt)
  ) {
    return snapshot.registrationClosesAt;
  }

  return snapshot.endsAt;
}

export function registrationAvailability(
  snapshot: Pick<
    EventSnapshot,
    "endsAt" | "registrationOpensAt" | "registrationClosesAt"
  >,
  now: Date,
): "NOT_OPEN_YET" | "OPEN" | "CLOSED" {
  const instant = now.getTime();

  if (instant >= Date.parse(registrationDeadline(snapshot))) {
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
