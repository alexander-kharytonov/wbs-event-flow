import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import {
  locationSchema,
  publicOrganizerSchema,
  scheduleSchema,
} from "@/features/events/schemas/event-rich-content";

export type ExactSchedule = z.infer<typeof scheduleSchema>;
export type ScheduleSource = { timezone: string; schedule: ExactSchedule };

export function localInstantValue(instant: string, timezone: string) {
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}

export function scheduleFormValues(schedule: ExactSchedule, timezone: string) {
  return schedule.map((entry, index) => ({
    key: `agenda_${index}`,
    sourceIndex: index as number | null,
    edited: false,
    title: entry.title,
    description: entry.description ?? "",
    startsAt: localInstantValue(entry.startsAt, timezone),
  }));
}

export function validateScheduleRange(
  schedule: ExactSchedule,
  startsAt: Date,
  endsAt: Date,
  addIssue: (index: number, message: string) => void,
) {
  for (const [index, entry] of schedule.entries()) {
    const instant = new Date(entry.startsAt).getTime();

    if (instant < startsAt.getTime() || instant >= endsAt.getTime()) {
      addIssue(index, "Agenda time must be within the event, before its end.");
    } else if (
      index > 0 &&
      instant < new Date(schedule[index - 1].startsAt).getTime()
    ) {
      addIssue(
        index,
        "Keep agenda entries in chronological order. Equal times are allowed.",
      );
    }
  }
}

// Form transport only. All consumers then use the same authoring schema.
export function eventFormInput(formData: FormData): Record<string, unknown> {
  const input: Record<string, unknown> = Object.fromEntries(formData);

  for (const field of ["location", "schedule", "publicOrganizer"]) {
    try {
      input[field] = JSON.parse(String(input[field]));
    } catch {
      input[field] = undefined;
    }
  }

  return input;
}

export function eventIssuePath(
  path: PropertyKey[],
  input?: Record<string, unknown>,
) {
  if (
    path[0] === "schedule" &&
    typeof path[1] === "number" &&
    Array.isArray(input?.schedule)
  ) {
    const key = input.schedule[path[1]]?.key;

    if (typeof key === "string" && /^agenda_[0-9]+$/.test(key)) {
      return ["title", "description", "startsAt"].includes(String(path[2]))
        ? ["schedule", key, ...path.slice(2)].join(".")
        : "schedule";
    }
  }

  if (path[0] === "location" && path[1] === "type") {
    return "location";
  }

  return path.map(String).join(".");
}

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a valid date and time.");
const optionalDateTime = z.union([z.literal(""), localDateTime]);

function isIanaTimezone(value: string) {
  // Temporal also accepts offsets; this form accepts named IANA zones only.
  if (!/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(value)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    Temporal.Now.zonedDateTimeISO(value);

    return true;
  } catch {
    return false;
  }
}

const eventInputFields = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter an event name.")
    .max(200, "Use at most 200 characters."),
  description: z.string().trim().max(20000, "Use at most 20,000 characters."),
  descriptionFormat: z.enum(["PLAIN_TEXT", "MARKDOWN"]),
  location: locationSchema.nullable(),
  publicOrganizer: publicOrganizerSchema.nullable(),
  schedule: z
    .array(
      z.strictObject({
        key: z.string().regex(/^agenda_[0-9]+$/),
        sourceIndex: z.number().int().min(0).max(99).nullable(),
        edited: z.boolean(),
        title: scheduleSchema.element.shape.title,
        description: z.string().max(2000),
        startsAt: localDateTime,
      }),
    )
    .max(100),
  startsAt: localDateTime,
  endsAt: localDateTime,
  timezone: z.string().refine(isIanaTimezone, "Choose a valid IANA timezone."),
  visibility: z.enum(["PRIVATE", "PUBLIC"], {
    error: "Choose Private or Public.",
  }),
  accountRequirement: z.enum(["OPTIONAL", "REQUIRED"], {
    error: "Choose Optional or Required.",
  }),
  maxGuestsPerRegistration: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(0).max(10)),
  capacity: z.union([
    z.literal("").transform(() => null),
    z
      .string()
      .regex(/^\d+$/, "Enter a whole number of at least 1.")
      .transform(Number)
      .pipe(
        z
          .number()
          .int()
          .min(1, "Capacity must be at least 1.")
          .max(2147483647, "Capacity is too large."),
      ),
  ]),
  registrationOpensAt: optionalDateTime,
  registrationClosesAt: optionalDateTime,
});

export const eventDateFields = [
  "startsAt",
  "endsAt",
  "registrationOpensAt",
  "registrationClosesAt",
] as const;

export type EventDateField = (typeof eventDateFields)[number];

export type PreservedEventDates = Partial<
  Record<EventDateField, string | null>
>;

export function validateEventDateRelationships(
  dates: {
    startsAt: Date;
    endsAt: Date;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
  },
  ctx: {
    addIssue: (issue: {
      code: "custom";
      path: string[];
      message: string;
    }) => void;
  },
) {
  const { startsAt, endsAt, registrationOpensAt, registrationClosesAt } = dates;

  if (startsAt >= endsAt) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "End must be after start.",
    });
  }

  if (registrationOpensAt && registrationOpensAt > startsAt) {
    ctx.addIssue({
      code: "custom",
      path: ["registrationOpensAt"],
      message: "Registration must open no later than the event start.",
    });
  }

  if (
    registrationOpensAt &&
    registrationClosesAt &&
    registrationOpensAt >= registrationClosesAt
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["registrationClosesAt"],
      message: "Registration close must be after registration open.",
    });
  }

  for (const [field, value] of [
    ["registrationOpensAt", registrationOpensAt],
    ["registrationClosesAt", registrationClosesAt],
  ] as const) {
    if (value && value > endsAt) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: "Registration must not extend beyond the event end.",
      });
    }
  }
}

function inputSchema(
  preserved: PreservedEventDates = {},
  source?: ScheduleSource,
) {
  return eventInputFields.transform((input, ctx) => {
    function toInstant(
      field:
        | "startsAt"
        | "endsAt"
        | "registrationOpensAt"
        | "registrationClosesAt",
    ) {
      if (Object.hasOwn(preserved, field)) {
        const instant = preserved[field];

        return instant ? new Date(instant) : null;
      }

      if (!input[field]) {
        return null;
      }

      try {
        const local = Temporal.PlainDateTime.from(input[field], {
          overflow: "reject",
        });
        const zoned = local.toZonedDateTime(input.timezone, {
          disambiguation: "reject",
        });

        return new Date(zoned.epochMilliseconds);
      } catch {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message:
            "Enter a valid local time. Times skipped or repeated by daylight saving changes are not accepted; choose another time.",
        });

        return null;
      }
    }

    const startsAt = toInstant("startsAt");
    const endsAt = toInstant("endsAt");
    const registrationOpensAt = toInstant("registrationOpensAt");
    const registrationClosesAt = toInstant("registrationClosesAt");

    if (!startsAt || !endsAt) {
      return z.NEVER;
    }

    validateEventDateRelationships(
      { startsAt, endsAt, registrationOpensAt, registrationClosesAt },
      ctx,
    );

    const keys = new Set<string>();
    const sources = new Set<number>();
    const schedule: ExactSchedule = [];

    for (const [index, entry] of input.schedule.entries()) {
      if (
        keys.has(entry.key) ||
        (entry.sourceIndex !== null && sources.has(entry.sourceIndex))
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["schedule"],
          message: "Agenda row identities must be unique.",
        });
      }
      keys.add(entry.key);

      if (entry.sourceIndex !== null) {
        sources.add(entry.sourceIndex);
      }

      try {
        const original =
          entry.sourceIndex === null
            ? undefined
            : source?.schedule[entry.sourceIndex];
        const preservedInstant =
          original &&
          !entry.edited &&
          source?.timezone === input.timezone &&
          entry.startsAt ===
            localInstantValue(original.startsAt, input.timezone);
        const instant = preservedInstant
          ? original.startsAt
          : new Date(
              Temporal.PlainDateTime.from(entry.startsAt, {
                overflow: "reject",
              }).toZonedDateTime(input.timezone, { disambiguation: "reject" })
                .epochMilliseconds,
            ).toISOString();
        schedule.push({
          title: entry.title,
          description: entry.description || null,
          startsAt: instant,
        });
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["schedule", index, "startsAt"],
          message:
            "Enter an unambiguous local time. DST skipped or repeated times are not accepted.",
        });
        schedule.push({
          title: entry.title,
          description: entry.description || null,
          startsAt: startsAt.toISOString(),
        });
      }
    }
    validateScheduleRange(schedule, startsAt, endsAt, (index, message) =>
      ctx.addIssue({
        code: "custom",
        path: ["schedule", index, "startsAt"],
        message,
      }),
    );

    return {
      ...input,
      schedule,
      description: input.description || null,
      startsAt,
      endsAt,
      registrationOpensAt,
      registrationClosesAt,
    };
  });
}

export const eventInputSchema = inputSchema();

// Preserved instants come from the validated template or the locked Event row.

export function parseEventWithPreservedDates(
  input: unknown,
  preserved: PreservedEventDates,
  source?: ScheduleSource,
) {
  return inputSchema(preserved, source).safeParse(input);
}

export type EventFormValues = z.input<typeof eventInputSchema>;

export type EventFormState = {
  errors?: Record<string, string[]>;
  message?: string;
  conflict?: boolean;
};

export function eventValidationError(
  error: z.ZodError,
  input?: Record<string, unknown>,
): EventFormState {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = eventIssuePath(issue.path, input);
    errors[field] = [...(errors[field] ?? []), issue.message];
  }

  return { errors, message: "Please correct the highlighted fields." };
}
