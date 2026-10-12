"use server";

import type { ApplicationFormState } from "@/features/events/application-input";
import { submitEventApplication } from "@/features/events/server/submit-application";

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
      key !== "guests" &&
      !key.startsWith("$ACTION_")
    ) {
      return { message: { code: "unknownRegistrationField" } };
    }
  }

  if (
    formData.getAll("fullName").length !== 1 ||
    formData.getAll("email").length !== 1
  ) {
    return { message: { code: "enterNameAndEmail" } };
  }

  let guests: unknown;

  try {
    if (
      formData.getAll("guests").length !== 1 ||
      typeof formData.get("guests") !== "string"
    ) {
      return { message: { code: "formInvalid" } };
    }
    guests = JSON.parse(formData.get("guests") as string);
  } catch {
    return { message: { code: "formInvalid" } };
  }

  return submitEventApplication({
    guests,
    publicId,
    eventRevisionId,
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    answers: Object.fromEntries(answers),
  });
}
