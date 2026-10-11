"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import type { Messages } from "@/lib/i18n/messages";
import { requireVerifiedUser } from "@/lib/session";

export type ProfileFormState = {
  name?: string;
  error?: keyof Messages["auth"];
  message?: keyof Messages["auth"];
  success?: true;
};

const profileNameSchema = z
  .string()
  .trim()
  .min(1, "enterName")
  .max(200, "nameTooLong");

export async function updateProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  await requireVerifiedUser();

  for (const key of formData.keys()) {
    if (key !== "name" && !key.startsWith("$ACTION_")) {
      return { message: "nameOnly" };
    }
  }

  if (formData.getAll("name").length !== 1) {
    return { error: "enterName" };
  }

  const parsed = profileNameSchema.safeParse(formData.get("name"));

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0].code === "too_big" ? "nameTooLong" : "enterName",
    };
  }

  try {
    // Better Auth resolves the current identity; no user ID comes from the form.
    await auth.api.updateUser({
      headers: await headers(),
      body: { name: parsed.data },
    });
  } catch {
    return { message: "profileUpdateFailed" };
  }

  revalidatePath("/", "layout");

  return { success: true, name: parsed.data };
}
