import { z } from "zod";

export const fieldTypeLabels = {
  SHORT_TEXT: "Short text",
  LONG_TEXT: "Long text",
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
  CHECKBOX: "Checkbox",
} as const;

export type FieldType = keyof typeof fieldTypeLabels;

export function isChoice(type: FieldType) {
  return type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE";
}

export const registrationFieldSchema = z
  .strictObject({
    label: z.string().trim().min(1, "Enter a question.").max(200),
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
          label: z.string().trim().min(1, "Enter an option label.").max(200),
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
          message: "This question type cannot have options.",
        });
      }

      return;
    }

    if (!field.options || field.options.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Add at least two options.",
      });
    }

    const labels =
      field.options?.map((option) => option.label.toLowerCase()) ?? [];

    if (new Set(labels).size !== labels.length) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Option labels must be unique (ignoring case).",
      });
    }
  });

const context = {
  eventId: z.string().min(1),
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
    fieldId: z.string().min(1),
    field: registrationFieldSchema,
  }),
  z.strictObject({
    ...context,
    kind: z.literal("delete"),
    fieldId: z.string().min(1),
  }),
  z.strictObject({
    ...context,
    kind: z.literal("reorder"),
    fieldIds: z.array(z.string().min(1)),
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
      message: string;
      conflict?: boolean;
    };
