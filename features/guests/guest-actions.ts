"use server";

import { refresh } from "next/cache";
import { addGuest, removeGuest } from "@/features/guests/server/manage-guests";
import { requireVerifiedUser } from "@/lib/session";

export async function addLinkedGuest(registrationId: string, input: unknown) {
  const user = await requireVerifiedUser();
  const result = await addGuest({ userId: user.id, registrationId }, input);
  refresh();

  return result;
}

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
