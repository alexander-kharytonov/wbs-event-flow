import {
  type EventDateField,
  type EventFormValues,
  eventDateFields,
  localInstantValue,
  type PreservedEventDates,
  parseEventWithPreservedDates,
  type ScheduleSource,
  scheduleFormValues,
} from "@/features/events/event-input-schema";
import {
  locationSchema,
  publicOrganizerSchema,
  scheduleSchema,
} from "@/features/events/schemas/event-rich-content";
import type { Event } from "@/generated/prisma/client";

export function eventFormValues(event: Event): EventFormValues {
  function localTime(date: Date | null) {
    if (!date) {
      return "";
    }

    return eventLocalDate(date.toISOString(), event.timezone);
  }

  return {
    descriptionFormat: event.descriptionFormat,
    location:
      event.location === null ? null : locationSchema.parse(event.location),
    publicOrganizer:
      event.publicOrganizer === null
        ? null
        : publicOrganizerSchema.parse(event.publicOrganizer),
    schedule: scheduleFormValues(
      scheduleSchema.parse(event.schedule),
      event.timezone,
    ),
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

export type EventDateSource = Record<EventDateField, string | null> &
  Partial<ScheduleSource> & {
    timezone: string;
  };

export function eventDateSource(event: Event): EventDateSource {
  return {
    timezone: event.timezone,
    schedule: scheduleSchema.parse(event.schedule),
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    registrationOpensAt: event.registrationOpensAt?.toISOString() ?? null,
    registrationClosesAt: event.registrationClosesAt?.toISOString() ?? null,
  };
}

export function eventLocalDate(instant: string | null, timezone: string) {
  return instant ? localInstantValue(instant, timezone) : "";
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

  return parseEventWithPreservedDates(input, preserved, {
    timezone: source.timezone,
    schedule: source.schedule ?? [],
  });
}
