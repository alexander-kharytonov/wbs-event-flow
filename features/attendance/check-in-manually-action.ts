"use server";

import { checkInManually } from "@/features/attendance/server/check-in-manually";
import { requireVerifiedUser } from "@/lib/session";

export async function checkInManuallyAction(input: unknown) {
  const user = await requireVerifiedUser();

  return checkInManually({ userId: user.id }, input);
}
