import {
  type ApplicationIssue,
  applicationAnswersSchema,
  applicationGuestsSchema,
  applicationInputSchema,
  applicationIssue,
  guestIssue,
  guestIssueKey,
} from "@/features/events/application-input";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

export function validateApplicationFields({
  preview,
  publicId,
  eventRevisionId,
  fields,
  maxGuestsPerRegistration,
  values,
  applicant,
  guests: guestValues,
  mapGuestErrors,
}: {
  preview: boolean;
  publicId: string;
  eventRevisionId: string;
  fields: EventSnapshot["registrationForm"]["fields"];
  maxGuestsPerRegistration: number;
  values: Record<string, string[]>;
  applicant?: { name: string; email: string };
  guests: { name: string; email: string; answers: Record<string, string[]> }[];
  mapGuestErrors: (
    errors: Record<string, ApplicationIssue>,
  ) => Record<string, ApplicationIssue>;
}) {
  const errors: Record<string, ApplicationIssue> = {};

  if (preview) {
    return errors;
  }
  const input = applicationInputSchema.safeParse({
    publicId,
    eventRevisionId,
    guests: guestValues,
    fullName: values.fullName?.[0] ?? applicant?.name ?? "",
    email: applicant?.email ?? values.email?.[0] ?? "",
    answers: Object.fromEntries(
      fields.map((field) => [field.id, values[`answer:${field.id}`] ?? []]),
    ),
  });

  if (!input.success) {
    for (const issue of input.error.issues) {
      errors[String(issue.path[0])] ??= applicationIssue(issue);
    }
  }
  const answers = applicationAnswersSchema({
    registrationForm: { fields },
  }).safeParse(
    Object.fromEntries(
      fields.map((field) => [field.id, values[`answer:${field.id}`] ?? []]),
    ),
  );

  if (!answers.success) {
    for (const issue of answers.error.issues) {
      errors[`answer:${String(issue.path[0])}`] ??= applicationIssue(issue);
    }
  }

  const guests = applicationGuestsSchema({
    registrationForm: { fields },
    maxGuestsPerRegistration,
  }).safeParse(guestValues);

  if (!guests.success) {
    Object.assign(
      errors,
      mapGuestErrors(
        Object.fromEntries(
          guests.error.issues.map((issue) => [
            guestIssueKey(issue),
            guestIssue(issue),
          ]),
        ),
      ),
    );
  }

  return errors;
}
