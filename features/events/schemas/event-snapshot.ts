import { z } from "zod";
import {
  isChoice,
  registrationFieldSchema,
} from "@/features/events/schemas/registration-form";

const fieldSchema = z
  .strictObject({
    id: z.string().min(1),
    type: z.enum([
      "SHORT_TEXT",
      "LONG_TEXT",
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "CHECKBOX",
    ]),
    label: z.string().trim().min(1).max(200),
    description: z.string().max(500).nullable(),
    required: z.boolean(),
    options: z.array(
      z.strictObject({
        id: z.string().min(1),
        label: z.string().trim().min(1).max(200),
      }),
    ),
  })
  .superRefine((field, ctx) => {
    // Validate the editable field rules without snapshot-only identifiers.
    const input = {
      label: field.label,
      type: field.type,
      required: field.required,
      description: field.description ?? "",
      ...(isChoice(field.type)
        ? { options: field.options.map(({ label }) => ({ label })) }
        : {}),
    };
    const validated = registrationFieldSchema.safeParse(input);

    if (
      !validated.success ||
      new Set(field.options.map((option) => option.id)).size !==
        field.options.length ||
      (!isChoice(field.type) && field.options.length > 0)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid registration question or options.",
      });
    }
  });

export const eventSnapshotSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(20000).nullable(),
    startsAt: z.iso.datetime({ precision: 3 }),
    endsAt: z.iso.datetime({ precision: 3 }),
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });

        return /^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(value);
      } catch {
        return false;
      }
    }),
    visibility: z.enum(["PUBLIC", "PRIVATE"]),
    accountRequirement: z.enum(["REQUIRED", "OPTIONAL"]),
    capacity: z.number().int().min(1).max(2147483647).nullable(),
    registrationOpensAt: z.iso.datetime({ precision: 3 }).nullable(),
    registrationClosesAt: z.iso.datetime({ precision: 3 }).nullable(),
    registrationForm: z.strictObject({ fields: z.array(fieldSchema) }),
  })
  .superRefine((event, ctx) => {
    const fieldIds = event.registrationForm.fields.map((field) => field.id);

    if (new Set(fieldIds).size !== fieldIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Registration question IDs must be unique.",
      });
    }

    if (event.startsAt >= event.endsAt) {
      ctx.addIssue({ code: "custom", message: "End must be after start." });
    }

    if (
      event.registrationOpensAt &&
      event.registrationClosesAt &&
      event.registrationOpensAt >= event.registrationClosesAt
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Registration close must be after registration open.",
      });
    }
  });

export type EventSnapshot = z.infer<typeof eventSnapshotSchema>;
