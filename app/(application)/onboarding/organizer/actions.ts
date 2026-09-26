"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureOrganizerProfile } from "@/features/organizer/server/ensure-organizer-profile";
import { requireVerifiedUser } from "@/lib/session";

export async function becomeOrganizer() {
  const user = await requireVerifiedUser();
  await ensureOrganizerProfile(user.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
