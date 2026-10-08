import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";

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

function inputSchema(preserved: PreservedEventDates = {}) {
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

    return {
      ...input,
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
) {
  return inputSchema(preserved).safeParse(input);
}

export type EventFormValues = z.input<typeof eventInputSchema>;

export type EventFormState = {
  errors?: Record<string, string[]>;
  message?: string;
  conflict?: boolean;
};

export function eventValidationError(error: z.ZodError): EventFormState {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0]);
    errors[field] = [...(errors[field] ?? []), issue.message];
  }

  return { errors, message: "Please correct the highlighted fields." };
}
