"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireVerifiedUser } from "@/lib/session";

export type ProfileFormState = {
  name?: string;
  error?: string;
  message?: string;
  success?: true;
};

const profileNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(200, "Use 200 characters or fewer.");

export async function updateProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  await requireVerifiedUser();

  for (const key of formData.keys()) {
    if (key !== "name" && !key.startsWith("$ACTION_")) {
      return { message: "Only your name can be updated." };
    }
  }

  if (formData.getAll("name").length !== 1) {
    return { error: "Enter your name." };
  }

  const parsed = profileNameSchema.safeParse(formData.get("name"));

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    // Better Auth resolves the current identity; no user ID comes from the form.
    await auth.api.updateUser({
      headers: await headers(),
      body: { name: parsed.data },
    });
  } catch {
    return { message: "Could not update your profile. Please try again." };
  }

  revalidatePath("/", "layout");

  return { success: true, name: parsed.data };
}
