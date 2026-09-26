"use server";

import { revalidatePath } from "next/cache";
import { withdrawOwnApplication } from "@/features/events/server/withdraw-application";
import { requireVerifiedUser } from "@/lib/session";

export async function withdrawApplication(input: unknown) {
  const user = await requireVerifiedUser();
  const result = await withdrawOwnApplication(user.id, input);

  if (result.success) {
    revalidatePath("/e/[publicId]", "page");
    revalidatePath("/dashboard/events/[id]", "layout");
  }

  return result;
}
