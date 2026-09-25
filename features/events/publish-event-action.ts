"use server";

import { revalidatePath } from "next/cache";
import { publishOwnedEvent } from "@/features/events/server/publish-event";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

export async function publishEvent(input: unknown) {
  const organizer = await requireOrganizer();
  const result = await publishOwnedEvent(organizer.id, input);

  if (result.success) {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/events/[id]", "layout");
  }

  return result;
}
