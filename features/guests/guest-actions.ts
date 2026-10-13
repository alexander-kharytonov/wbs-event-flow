"use server";

import { refresh } from "next/cache";
import { removeGuest } from "@/features/guests/server/manage-guests";
import { requireVerifiedUser } from "@/lib/session";

export async function removeLinkedGuest(
  registrationId: string,
  guestId: string,
) {
  const user = await requireVerifiedUser();
  const result = await removeGuest(
    { userId: user.id, registrationId },
    guestId,
  );
  refresh();

  return result;
}
