import { z } from "zod";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

export type ApplicationFormState = {
  message?: string;
  errors?: Record<string, string>;
};

export const applicationInputSchema = z.strictObject({
  publicId: z.string().min(1),
  eventRevisionId: z.string().min(1),
  fullName: z.string().trim().min(1, "Enter your full name.").max(200),
  email: z
    .string()
    .trim()
    .pipe(z.email())
    .transform((email) => email.toLowerCase()),
  answers: z.record(z.string(), z.array(z.string())),
});

export function applicationAnswersSchema(snapshot: EventSnapshot) {
  const shape = snapshot.registrationForm.fields.map((field) => {
    const values = z
      .array(z.string())
      .transform((answer) =>
        field.type === "SINGLE_CHOICE" &&
        answer.length === 1 &&
        answer[0] === ""
          ? []
          : answer,
      )
      .superRefine((answer, ctx) => {
        const invalid = (message: string) =>
          ctx.addIssue({ code: "custom", message });

        if (field.type === "SHORT_TEXT" || field.type === "LONG_TEXT") {
          if (answer.length > 1) {
            invalid("Enter a single text answer.");
          }

          const text = (answer[0] ?? "").trim();
          const limit = field.type === "SHORT_TEXT" ? 500 : 5000;

          if (field.required && !text) {
            invalid("This question is required.");
          }

          if (text.length > limit) {
            invalid(`Use at most ${limit} characters.`);
          }
        } else if (field.type === "CHECKBOX") {
          if (answer.length > 1 || answer.some((value) => value !== "true")) {
            invalid("Invalid checkbox answer.");
          }

          if (field.required && answer[0] !== "true") {
            invalid("This checkbox is required.");
          }
        } else {
          const allowed = new Set(field.options.map((option) => option.id));

          if (answer.some((id) => !allowed.has(id))) {
            invalid("Choose an option from this question.");
          }

          if (new Set(answer).size !== answer.length) {
            invalid("Choose each option only once.");
          }

          if (field.type === "SINGLE_CHOICE" && answer.length > 1) {
            invalid("Choose only one option.");
          }

          if (field.required && answer.length === 0) {
            invalid("Choose at least one option.");
          }
        }
      });

    return [
      field.id,
      values.prefault([]).transform((answer) => ({
        fieldId: field.id,
        textValue:
          field.type === "SHORT_TEXT" || field.type === "LONG_TEXT"
            ? (answer[0] ?? "").trim() || null
            : null,
        booleanValue: field.type === "CHECKBOX" ? answer[0] === "true" : null,
        selectedOptions: {
          create:
            field.type === "SINGLE_CHOICE" || field.type === "MULTIPLE_CHOICE"
              ? answer.map((optionId) => ({ optionId }))
              : [],
        },
      })),
    ] as const;
  });

  return z.strictObject(Object.fromEntries(shape));
}
