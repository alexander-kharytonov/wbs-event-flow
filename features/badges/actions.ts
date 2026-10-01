"use server";

import { revalidatePath } from "next/cache";
import {
  buildBadgePresentation,
  saveBadgeLayout,
} from "@/features/badges/server/badges";
import { requireVerifiedUser } from "@/lib/session";

export async function previewBadge(eventId: string, layout: unknown) {
  const user = await requireVerifiedUser();

  try {
    return await buildBadgePresentation(
      { userId: user.id },
      { eventId },
      { mode: "PREVIEW", draftLayout: layout },
    );
  } catch {
    return null;
  }
}

export async function updateBadgeLayout(input: unknown) {
  const user = await requireVerifiedUser();

  try {
    const result = await saveBadgeLayout({ userId: user.id }, input);

    if (result.success) {
      revalidatePath("/dashboard", "layout");
    }

    return result;
  } catch {
    return {
      success: false,
      message: "Could not save the badge layout. Please try again.",
    };
  }
}
