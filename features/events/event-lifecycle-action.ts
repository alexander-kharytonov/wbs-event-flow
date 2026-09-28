"use server";

import { revalidatePath } from "next/cache";
import { changeOwnedEventLifecycle } from "@/features/events/server/event-lifecycle";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

export async function changeEventLifecycle(input: unknown) {
  const organizer = await requireOrganizer();
  const result = await changeOwnedEventLifecycle(organizer.id, input);

  if (result.success) {
    revalidatePath("/dashboard", "layout");
    revalidatePath("/e", "layout");
    revalidatePath("/account/registrations", "layout");
  }

  return result;
}
