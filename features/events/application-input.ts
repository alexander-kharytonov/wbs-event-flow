import { z } from "zod";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";
import type { Messages } from "@/lib/i18n/messages";

export type ApplicationIssue = {
  code: keyof Messages["events"];
  values?: Record<string, number>;
};

export type ApplicationFormState = {
  success?: true;
  message?: ApplicationIssue;
  errors?: Record<string, ApplicationIssue>;
};

export const applicationInputSchema = z.strictObject({
  publicId: z.uuid(),
  eventRevisionId: z.uuid(),
  fullName: z.string().trim().min(1, "fullNameRequired").max(200),
  email: z
    .string()
    .trim()
    .pipe(z.email())
    .transform((email) => email.toLowerCase()),
  answers: z.record(z.string(), z.array(z.string())),
  guests: z.array(z.unknown()).max(10),
});

export function applicationAnswersSchema(snapshot: {
  registrationForm: Pick<EventSnapshot["registrationForm"], "fields">;
}) {
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
        const invalid = (
          message: ApplicationIssue["code"],
          values?: Record<string, number>,
        ) => ctx.addIssue({ code: "custom", message, params: { values } });

        if (field.type === "SHORT_TEXT" || field.type === "LONG_TEXT") {
          if (answer.length > 1) {
            invalid("singleTextAnswer");
          }

          const text = (answer[0] ?? "").trim();
          const limit = field.type === "SHORT_TEXT" ? 500 : 5000;

          if (field.required && !text) {
            invalid("questionRequired");
          }

          if (text.length > limit) {
            invalid("answerMaxLength", { count: limit });
          }
        } else if (field.type === "CHECKBOX") {
          if (answer.length > 1 || answer.some((value) => value !== "true")) {
            invalid("invalidCheckbox");
          }

          if (field.required && answer[0] !== "true") {
            invalid("checkboxRequired");
          }
        } else {
          const allowed = new Set(field.options.map((option) => option.id));

          if (answer.some((id) => !allowed.has(id))) {
            invalid("chooseQuestionOption");
          }

          if (new Set(answer).size !== answer.length) {
            invalid("chooseOptionOnce");
          }

          if (field.type === "SINGLE_CHOICE" && answer.length > 1) {
            invalid("chooseOneOption");
          }

          if (field.required && answer.length === 0) {
            invalid("chooseAtLeastOne");
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

// Only controlled validation codes cross the action boundary; question content stays untouched.
export function applicationIssue(issue: z.core.$ZodIssue): ApplicationIssue {
  if (issue.code === "custom") {
    const codes = [
      "singleTextAnswer",
      "questionRequired",
      "answerMaxLength",
      "invalidCheckbox",
      "checkboxRequired",
      "chooseQuestionOption",
      "chooseOptionOnce",
      "chooseOneOption",
      "chooseAtLeastOne",
    ] as const;
    const code = codes.find((code) => code === issue.message);

    if (code) {
      return {
        code,
        ...(code === "answerMaxLength"
          ? { values: { count: Number(issue.params?.values?.count) } }
          : {}),
      };
    }
  }

  if (issue.path[0] === "email") {
    return { code: "invalidEmail" };
  }

  if (issue.code === "too_big") {
    return {
      code: "answerMaxLength",
      values: { count: Number(issue.maximum) },
    };
  }

  return {
    code: issue.path[0] === "fullName" ? "fullNameRequired" : "invalidAnswer",
  };
}

export function applicationGuestsSchema(
  snapshot: Pick<
    EventSnapshot,
    "guestPolicy" | "maxGuestsPerRegistration" | "guestForm"
  >,
) {
  return z
    .array(
      z.strictObject({
        name: applicationInputSchema.shape.fullName,
        email: z.preprocess(
          (value) =>
            typeof value === "string" && !value.trim() ? null : value,
          applicationInputSchema.shape.email
            .nullable()
            .optional()
            .transform((value) => value ?? null),
        ),
        answers: applicationAnswersSchema({
          registrationForm: snapshot.guestForm,
        }),
      }),
    )
    .max(
      snapshot.guestPolicy === "APPROVAL_REQUIRED"
        ? snapshot.maxGuestsPerRegistration
        : 0,
    );
}

export function guestIssue(issue: z.core.$ZodIssue): ApplicationIssue {
  if (issue.path.length === 0) {
    return { code: "guestLimitReached" };
  }

  return applicationIssue({
    ...issue,
    path: [
      issue.path[1] === "name" ? "fullName" : issue.path[1],
      ...issue.path.slice(2),
    ],
  });
}

export function guestIssueKey(issue: z.core.$ZodIssue) {
  return issue.path.length ? `guest:${issue.path.join(":")}` : "guests";
}
