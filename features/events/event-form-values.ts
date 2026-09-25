import { Temporal } from "@js-temporal/polyfill";
import type { EventFormValues } from "@/features/events/event-input-schema";
import type { Event } from "@/generated/prisma/client";

export function eventFormValues(event: Event): EventFormValues {
  function localTime(date: Date | null) {
    if (!date) {
      return "";
    }

    return Temporal.Instant.from(date.toISOString())
      .toZonedDateTimeISO(event.timezone)
      .toPlainDateTime()
      .toString({ smallestUnit: "minute" });
  }

  return {
    title: event.title,
    description: event.description ?? "",
    startsAt: localTime(event.startsAt),
    endsAt: localTime(event.endsAt),
    timezone: event.timezone,
    visibility: event.visibility,
    accountRequirement: event.accountRequirement,
    capacity: event.capacity?.toString() ?? "",
    registrationOpensAt: localTime(event.registrationOpensAt),
    registrationClosesAt: localTime(event.registrationClosesAt),
  };
}
