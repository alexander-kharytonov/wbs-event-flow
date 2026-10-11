import { z } from "zod";
import type { Messages } from "@/lib/i18n/messages";

export const fieldTypeLabels = {
  SHORT_TEXT: "questionShortText",
  LONG_TEXT: "questionLongText",
  SINGLE_CHOICE: "questionSingle",
  MULTIPLE_CHOICE: "questionMultiple",
  CHECKBOX: "questionCheckbox",
} as const;

export type FieldType = keyof typeof fieldTypeLabels;

export function isChoice(type: FieldType) {
  return type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE";
}

export const registrationFieldSchema = z
  .strictObject({
    label: z.string().trim().min(1, "questionEnter").max(200),
    description: z.string().trim().max(500).optional(),
    type: z.enum([
      "SHORT_TEXT",
      "LONG_TEXT",
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "CHECKBOX",
    ]),
    required: z.boolean(),
    options: z
      .array(
        z.strictObject({
          label: z.string().trim().min(1, "questionOptionEnter").max(200),
        }),
      )
      .optional(),
  })
  .superRefine((field, ctx) => {
    if (!isChoice(field.type)) {
      if (field.options !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "questionNoOptions",
        });
      }

      return;
    }

    if (!field.options || field.options.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "questionTwoOptions",
      });
    }

    const labels =
      field.options?.map((option) => option.label.toLowerCase()) ?? [];

    if (new Set(labels).size !== labels.length) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "questionUniqueOptions",
      });
    }
  });

const context = {
  eventId: z.uuid(),
  version: z.iso.datetime({ precision: 3 }),
};

export const registrationMutationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...context,
    kind: z.literal("add"),
    field: registrationFieldSchema,
  }),
  z.strictObject({
    ...context,
    kind: z.literal("edit"),
    fieldId: z.uuid(),
    field: registrationFieldSchema,
  }),
  z.strictObject({
    ...context,
    kind: z.literal("delete"),
    fieldId: z.uuid(),
  }),
  z.strictObject({
    ...context,
    kind: z.literal("reorder"),
    fieldIds: z.array(z.uuid()),
  }),
]);

export type RegistrationMutation = z.infer<typeof registrationMutationSchema>;

export type RegistrationFieldInput = z.infer<typeof registrationFieldSchema>;

export type BuilderField = Omit<RegistrationFieldInput, "options"> & {
  id: string;
  options: { label: string }[];
};

export type BuilderForm = { version: string; fields: BuilderField[] };

export type RegistrationResult =
  | { form: BuilderForm; message?: never; conflict?: never }
  | {
      form?: never;
      message: keyof Messages["events"];
      conflict?: boolean;
      fieldErrors?: Record<string, keyof Messages["events"]>;
    };

// Shared normalized workspace mapping for individual edits and template creation.
export function registrationFieldData(input: RegistrationFieldInput) {
  const field = registrationFieldSchema.parse(input);

  return {
    type: field.type,
    label: field.label,
    description: field.description || null,
    required: field.required,
    options: (field.options ?? []).map((option, position) => ({
      label: option.label,
      position,
    })),
  };
}

export function registrationFieldIssue(
  issue: z.core.$ZodIssue,
): keyof Messages["events"] {
  const codes = [
    "questionEnter",
    "questionOptionEnter",
    "questionNoOptions",
    "questionTwoOptions",
    "questionUniqueOptions",
  ] as const;
  const code = codes.find((value) => value === issue.message);

  if (code) {
    return code;
  }

  if (issue.code === "too_big") {
    return issue.path.includes("description")
      ? "coverAltLong"
      : "questionMaxLabel";
  }

  return "questionCheck";
}
