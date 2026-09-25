"use server";

import { redirect } from "next/navigation";
import type { ApplicationFormState } from "@/features/events/application-input";
import { submitAnonymousApplication } from "@/features/events/server/submit-application";

export async function submitApplication(
  publicId: string,
  eventRevisionId: string,
  _previous: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  const answers = new Map<string, FormDataEntryValue[]>();

  for (const [key, value] of formData) {
    if (key.startsWith("answer:")) {
      const fieldId = key.slice("answer:".length);
      answers.set(fieldId, [...(answers.get(fieldId) ?? []), value]);
    } else if (
      key !== "fullName" &&
      key !== "email" &&
      !key.startsWith("$ACTION_")
    ) {
      return { message: "This registration form contains an unknown field." };
    }
  }

  if (
    formData.getAll("fullName").length !== 1 ||
    formData.getAll("email").length !== 1
  ) {
    return { message: "Enter your full name and email." };
  }

  const result = await submitAnonymousApplication({
    publicId,
    eventRevisionId,
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    answers: Object.fromEntries(answers),
  });

  if (!result.success) {
    return { message: result.message, errors: result.errors };
  }

  redirect(`/e/${encodeURIComponent(publicId)}/submitted`);
}
