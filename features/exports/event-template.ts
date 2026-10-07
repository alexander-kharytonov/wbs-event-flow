import { z } from "zod";
import {
  badgeFieldSchema,
  badgeLayoutSchema,
} from "@/features/badges/badge-layout";
import { eventInputSchema } from "@/features/events/event-input-schema";
import {
  isChoice,
  registrationFieldSchema,
} from "@/features/events/schemas/registration-form";

export const TEMPLATE_V1_LIMITS = {
  bytes: 512 * 1024,
  fields: 100,
  optionsPerField: 100,
  optionsTotal: 1000,
  staff: 100,
} as const;

const errorMessages = {
  limits:
    "This event exceeds Template v1 limits (100 questions, 100 options per question, 1,000 options total, 100 staff, 512 KiB). No partial file was produced.",
  binding:
    "The badge design references a field no longer present in the current form. Update Badge Design before exporting the template.",
  layout:
    "The saved badge design is invalid. Update Badge Design before exporting the template.",
  configuration:
    "Could not export the current event configuration. No partial file was produced.",
} as const;

export class EventTemplateError extends Error {
  constructor(code: keyof typeof errorMessages) {
    super(errorMessages[code]);
  }
}

export function checkTemplateCounts(
  fields: number,
  optionCounts: number[],
  staff: number,
) {
  if (
    fields > TEMPLATE_V1_LIMITS.fields ||
    staff > TEMPLATE_V1_LIMITS.staff ||
    optionCounts.some((count) => count > TEMPLATE_V1_LIMITS.optionsPerField) ||
    optionCounts.reduce((sum, count) => sum + count, 0) >
      TEMPLATE_V1_LIMITS.optionsTotal
  ) {
    throw new EventTemplateError("limits");
  }
}

const fieldKeySchema = z.string().regex(/^field_[1-9]\d*$/);
const portableFieldSchema = z
  .strictObject({
    key: fieldKeySchema,
    type: registrationFieldSchema.shape.type,
    label: registrationFieldSchema.shape.label,
    description: registrationFieldSchema.shape.description.unwrap().nullable(),
    required: registrationFieldSchema.shape.required,
    options: z
      .array(z.strictObject({ label: z.string() }))
      .max(TEMPLATE_V1_LIMITS.optionsPerField),
  })
  .superRefine((field, ctx) => {
    const result = registrationFieldSchema.safeParse({
      type: field.type,
      label: field.label,
      description: field.description ?? "",
      required: field.required,
      ...(isChoice(field.type) || field.options.length > 0
        ? { options: field.options }
        : {}),
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
      }
    }
  });
const portableBadgeFieldSchema = z.strictObject({
  fieldKey: fieldKeySchema,
  type: badgeFieldSchema.shape.type,
  label: badgeFieldSchema.shape.label,
});
const portableBadgeLayoutSchema = badgeLayoutSchema.extend({
  secondaryField: portableBadgeFieldSchema.nullable(),
  tertiaryField: portableBadgeFieldSchema.nullable(),
  // Defaults belong to stored-layout parsing, not the strict portable contract.
  paddingMm: badgeLayoutSchema.shape.paddingMm.removeDefault(),
});
const instantSchema = z.iso.datetime({ precision: 3 });
const eventFields = eventInputSchema.in.shape;

export const eventTemplateV1Schema = z
  .strictObject({
    format: z.literal("event-flow-template"),
    version: z.literal(1),
    event: z.strictObject({
      title: eventFields.title,
      description: eventFields.description.nullable(),
      startsAt: instantSchema,
      endsAt: instantSchema,
      timezone: eventFields.timezone,
      visibility: eventFields.visibility,
      accountRequirement: eventFields.accountRequirement,
      capacity: z.number().int().min(1).max(2147483647).nullable(),
      maxGuestsPerRegistration: z.number().int().min(0).max(10),
      registrationOpensAt: instantSchema.nullable(),
      registrationClosesAt: instantSchema.nullable(),
      registrationForm: z.strictObject({
        fields: z.array(portableFieldSchema).max(TEMPLATE_V1_LIMITS.fields),
      }),
      staff: z
        .array(
          z.strictObject({
            email: z.string().trim().toLowerCase().pipe(z.email()),
            role: z.enum(["MANAGER", "RECEPTION"]),
          }),
        )
        .max(TEMPLATE_V1_LIMITS.staff),
      badgeLayout: portableBadgeLayoutSchema.nullable(),
    }),
  })
  .superRefine(({ event }, ctx) => {
    const fields = event.registrationForm.fields;

    if (
      fields.reduce((sum, field) => sum + field.options.length, 0) >
      TEMPLATE_V1_LIMITS.optionsTotal
    ) {
      ctx.addIssue({ code: "custom", message: "Too many options." });
    }

    for (const [index, field] of fields.entries()) {
      if (field.key !== `field_${index + 1}`) {
        ctx.addIssue({
          code: "custom",
          path: ["event", "registrationForm", "fields", index, "key"],
          message: "Invalid field key order.",
        });
      }
    }

    for (const binding of [
      event.badgeLayout?.secondaryField,
      event.badgeLayout?.tertiaryField,
    ]) {
      if (
        binding &&
        !fields.some(
          (field) =>
            field.key === binding.fieldKey &&
            field.type === binding.type &&
            field.label === binding.label,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Invalid badge field binding.",
        });
      }
    }
  });

export type EventTemplateV1 = z.infer<typeof eventTemplateV1Schema>;

export function serializeEventTemplate(template: EventTemplateV1) {
  checkTemplateCounts(
    template.event.registrationForm.fields.length,
    template.event.registrationForm.fields.map((field) => field.options.length),
    template.event.staff.length,
  );
  const parsed = eventTemplateV1Schema.safeParse(template);

  if (!parsed.success) {
    throw new EventTemplateError("configuration");
  }

  // Schema parsing fixes property order independently of the caller's insertion order.
  const json = `${JSON.stringify(parsed.data, null, 2)}\n`;

  if (new TextEncoder().encode(json).byteLength > TEMPLATE_V1_LIMITS.bytes) {
    throw new EventTemplateError("limits");
  }

  return json;
}
