import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import { eventLanguageSchema } from "@/features/events/event-language";
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
      addIssue(index, "inputAgendaRange");
    } else if (
      index > 0 &&
      instant < new Date(schedule[index - 1].startsAt).getTime()
    ) {
      addIssue(index, "inputAgendaOrder");
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
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "inputDateTime");
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
  language: eventLanguageSchema,
  title: z.string().trim().min(1, "inputEventName").max(200, "inputMax200"),
  description: z.string().trim().max(20000, "inputMax20000"),
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
  timezone: z.string().refine(isIanaTimezone, "inputTimezone"),
  visibility: z.enum(["PRIVATE", "PUBLIC"], {
    error: "inputVisibility",
  }),
  accountRequirement: z.enum(["OPTIONAL", "REQUIRED"], {
    error: "inputAccountRequirement",
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
      .regex(/^\d+$/, "inputWholeNumber")
      .transform(Number)
      .pipe(
        z
          .number()
          .int()
          .min(1, "inputCapacityMin")
          .max(2147483647, "inputCapacityMax"),
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
      message: "inputEndAfterStart",
    });
  }

  if (registrationOpensAt && registrationOpensAt > startsAt) {
    ctx.addIssue({
      code: "custom",
      path: ["registrationOpensAt"],
      message: "inputRegistrationBeforeStart",
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
      message: "inputRegistrationCloseAfterOpen",
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
        message: "inputRegistrationBeforeEnd",
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
          message: "inputLocalTime",
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
          message: "inputAgendaIdentity",
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
          message: "inputAgendaLocalTime",
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
  creationUncertain?: boolean;
  createdId?: string;
  saved?: {
    passwordProtected: boolean;
    version: string;
    values: EventFormValues;
    dates: import("@/features/events/event-form-values").EventDateSource;
    startLocked: boolean;
  };
  errors?: Record<string, string[]>;
  message?: string;
  conflict?: boolean;
};

const eventInputMessageCodes = new Set<string>([
  "inputAgendaRange",
  "inputAgendaOrder",
  "inputDateTime",
  "inputEventName",
  "inputMax200",
  "inputMax20000",
  "inputTimezone",
  "inputVisibility",
  "inputAccountRequirement",
  "inputWholeNumber",
  "inputCapacityMin",
  "inputCapacityMax",
  "inputEndAfterStart",
  "inputRegistrationBeforeStart",
  "inputRegistrationCloseAfterOpen",
  "inputRegistrationBeforeEnd",
  "inputLocalTime",
  "inputAgendaIdentity",
  "inputAgendaLocalTime",
  "inputCorrectFields",
  "inputRequired",
  "inputInvalid",
  "inputPublicUrl",
  "inputMax1000",
  "inputMax2000",
  "inputMax2048",
  "inputAgendaMax",
  "inputGuestsRange",
  "inputSaveFailed",
  "inputSaveReload",
  "inputEditingUnavailable",
  "inputReadOnly",
  "inputEditConflict",
  "inputOngoingDates",
  "inputChanged",
  "inputChangesSaveFailed",
  "inputSaveUnconfirmed",
  "inputCompleteReview",
  "inputCheckReview",
  "inputStaffEmails",
  "inputCreationUnconfirmed",
]);

export function eventInputIssueMessage(issue: z.core.$ZodIssue): string {
  if (eventInputMessageCodes.has(issue.message)) {
    return issue.message;
  }

  if (issue.path[0] === "language") {
    return "invalidEventLanguage";
  }

  if (issue.path[0] === "maxGuestsPerRegistration") {
    return "inputGuestsRange";
  }

  if (issue.code === "too_big") {
    if (issue.origin === "array" && issue.path[0] === "schedule") {
      return "inputAgendaMax";
    }

    if (issue.origin === "string") {
      switch (issue.maximum) {
        case 200:
          return "inputMax200";
        case 1000:
          return "inputMax1000";
        case 2000:
          return "inputMax2000";
        case 2048:
          return "inputMax2048";
        case 20000:
          return "inputMax20000";
      }
    }
  }

  if (issue.code === "too_small" && issue.origin === "string") {
    return "inputRequired";
  }

  if (["onlineUrl", "websiteUrl"].includes(String(issue.path.at(-1)))) {
    return "inputPublicUrl";
  }

  return "inputInvalid";
}

export function eventValidationError(
  error: z.ZodError,
  input?: Record<string, unknown>,
): EventFormState {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = eventIssuePath(issue.path, input);
    errors[field] = [...(errors[field] ?? []), eventInputIssueMessage(issue)];
  }

  return { errors, message: "inputCorrectFields" };
}
