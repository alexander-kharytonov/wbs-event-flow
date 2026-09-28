export type EventLifecycleData = {
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
  archivedAt: Date | null;
};

export function eventLifecycle(event: EventLifecycleData, now: Date) {
  if (event.cancelledAt) {
    return "Cancelled";
  }

  if (now >= event.endsAt) {
    return "Completed";
  }

  return now < event.startsAt ? "Upcoming" : "Ongoing";
}

export function workspaceReadOnly(event: EventLifecycleData, now: Date) {
  return Boolean(event.archivedAt || event.cancelledAt || now >= event.endsAt);
}

export function applicationsFrozen(event: EventLifecycleData, now: Date) {
  return Boolean(event.cancelledAt || now >= event.endsAt);
}
