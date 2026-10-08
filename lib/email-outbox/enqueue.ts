import "server-only";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

export const emailOutboxChannel = "event_flow_email_outbox";

export function emailEventSnapshot(snapshot: EventSnapshot, publicId: string) {
  return {
    title: snapshot.title,
    startsAt: snapshot.startsAt,
    endsAt: snapshot.endsAt,
    timezone: snapshot.timezone,
    publicId,
  };
}
