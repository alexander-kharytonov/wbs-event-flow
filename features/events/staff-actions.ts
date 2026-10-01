"use server";

import { revalidatePath } from "next/cache";
import { manageEventStaff } from "@/features/events/server/manage-staff";
import { requireVerifiedUser } from "@/lib/session";

export async function updateStaff(input: unknown) {
  const user = await requireVerifiedUser();
  const result = await manageEventStaff(user.id, input);

  if (result.success) {
    revalidatePath("/dashboard", "layout");
  }

  return result;
}
