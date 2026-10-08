"use server";

import { revalidatePath } from "next/cache";
import {
  previewManualMessage,
  sendManualMessage,
} from "@/features/communications/server/manual-service";
import { requireVerifiedUser } from "@/lib/session";

export async function previewMessage(input: unknown) {
  const user = await requireVerifiedUser();

  return previewManualMessage(user.id, input);
}

export async function queueMessage(input: unknown) {
  const user = await requireVerifiedUser();
  const result = await sendManualMessage(user.id, input);

  if (result.success) {
    revalidatePath("/dashboard/events/[id]/communications", "page");
  }

  return result;
}
