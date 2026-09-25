"use server";

import { revalidatePath } from "next/cache";
import { mutateRegistrationForm } from "@/features/events/server/registration-form";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

export async function changeRegistrationForm(input: unknown) {
  const organizer = await requireOrganizer();
  const result = await mutateRegistrationForm(organizer.id, input);

  if (result.form) {
    revalidatePath("/dashboard/events/[id]/registration-form", "page");
  }

  return result;
}
