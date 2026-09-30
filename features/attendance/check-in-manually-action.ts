"use server";

import { checkInManually } from "@/features/attendance/server/check-in-manually";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { requireVerifiedUser } from "@/lib/session";

export async function checkInManuallyAction(input: unknown) {
  const user = await requireVerifiedUser();
  const organizer = await requireOrganizer();

  return checkInManually({ userId: user.id, organizerId: organizer.id }, input);
}
