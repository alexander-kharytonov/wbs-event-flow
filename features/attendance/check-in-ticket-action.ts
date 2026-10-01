"use server";

import { checkInTicket } from "@/features/attendance/server/check-in-ticket";
import { requireVerifiedUser } from "@/lib/session";

export async function checkInTicketAction(input: unknown) {
  const user = await requireVerifiedUser();

  return checkInTicket({ userId: user.id }, input);
}
