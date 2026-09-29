"use server";

import { checkInTicket } from "@/features/attendance/server/check-in-ticket";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { requireVerifiedUser } from "@/lib/session";

export async function checkInTicketAction(input: unknown) {
  const user = await requireVerifiedUser();
  const organizer = await requireOrganizer();

  return checkInTicket({ userId: user.id, organizerId: organizer.id }, input);
}
