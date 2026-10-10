import { z } from "zod";
import {
  coverDescriptorSchema,
  locationSchema,
  publicOrganizerSchema,
  scheduleSchema,
} from "@/features/events/schemas/event-rich-content";

// Frozen serialized v3 contract. Do not derive these rules from current authoring.
const snapshotOptionSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(200),
});

const snapshotFieldSchema = z
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
    options: z.array(snapshotOptionSchema),
  })
  .superRefine((field, ctx) => {
    const choice =
      field.type === "SINGLE_CHOICE" || field.type === "MULTIPLE_CHOICE";
    const optionIds = field.options.map((option) => option.id);
    const optionLabels = field.options.map((option) =>
      option.label.toLowerCase(),
    );

    if (
      new Set(optionIds).size !== optionIds.length ||
      (choice &&
        (field.options.length < 2 ||
          new Set(optionLabels).size !== optionLabels.length)) ||
      (!choice && field.options.length > 0)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid registration question or options.",
      });
    }
  });

export const eventSnapshotSchema = z
  .strictObject({
    schemaVersion: z.literal(3),
    maxGuestsPerRegistration: z.number().int().min(0).max(10),
    descriptionFormat: z.enum(["PLAIN_TEXT", "MARKDOWN"]),
    cover: coverDescriptorSchema.nullable(),
    location: locationSchema.nullable(),
    schedule: scheduleSchema,
    publicOrganizer: publicOrganizerSchema.nullable(),
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
    registrationForm: z.strictObject({
      fields: z.array(snapshotFieldSchema),
    }),
  })
  .superRefine((event, ctx) => {
    for (const [index, entry] of event.schedule.entries()) {
      if (
        entry.startsAt < event.startsAt ||
        entry.startsAt >= event.endsAt ||
        (index > 0 && entry.startsAt < event.schedule[index - 1].startsAt)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["schedule", index, "startsAt"],
          message:
            "Agenda must be chronological and within the event interval.",
        });
      }
    }
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
