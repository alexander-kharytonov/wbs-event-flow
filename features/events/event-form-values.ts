import { Temporal } from "@js-temporal/polyfill";
import {
  type EventDateField,
  type EventFormValues,
  eventDateFields,
  type PreservedEventDates,
  parseEventWithPreservedDates,
} from "@/features/events/event-input-schema";
import type { Event } from "@/generated/prisma/client";

export function eventFormValues(event: Event): EventFormValues {
  function localTime(date: Date | null) {
    if (!date) {
      return "";
    }

    return eventLocalDate(date.toISOString(), event.timezone);
  }

  return {
    title: event.title,
    description: event.description ?? "",
    startsAt: localTime(event.startsAt),
    endsAt: localTime(event.endsAt),
    timezone: event.timezone,
    visibility: event.visibility,
    accountRequirement: event.accountRequirement,
    maxGuestsPerRegistration: event.maxGuestsPerRegistration.toString(),
    capacity: event.capacity?.toString() ?? "",
    registrationOpensAt: localTime(event.registrationOpensAt),
    registrationClosesAt: localTime(event.registrationClosesAt),
  };
}

export type EventDateSource = Record<EventDateField, string | null> & {
  timezone: string;
};

export function eventDateSource(event: Event): EventDateSource {
  return {
    timezone: event.timezone,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    registrationOpensAt: event.registrationOpensAt?.toISOString() ?? null,
    registrationClosesAt: event.registrationClosesAt?.toISOString() ?? null,
  };
}

export function eventLocalDate(instant: string | null, timezone: string) {
  return instant
    ? Temporal.Instant.from(instant)
        .toZonedDateTimeISO(timezone)
        .toPlainDateTime()
        .toString({ smallestUnit: "minute" })
    : "";
}

// On update, source must be derived from the locked DB row, never client timestamps.
export function parseEventEdit(
  input: Record<string, unknown>,
  source: EventDateSource,
  editedDates: EventDateField[],
  startLocked: boolean,
) {
  const preserved: PreservedEventDates = {};

  for (const field of eventDateFields) {
    if (editedDates.includes(field)) {
      continue;
    }

    const lockedStart = field === "startsAt" && startLocked;

    if (!lockedStart && input.timezone !== source.timezone) {
      continue;
    }

    // A locked start follows the display zone without changing its instant.
    // Comparing the displayed value also detects edits with omitted client flags.
    try {
      const timezone = lockedStart ? input.timezone : source.timezone;

      if (
        typeof timezone === "string" &&
        input[field] === eventLocalDate(source[field], timezone)
      ) {
        preserved[field] = source[field];
      }
    } catch {
      // The shared schema reports invalid timezone/local input safely.
    }
  }

  return parseEventWithPreservedDates(input, preserved);
}
