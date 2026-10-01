import "server-only";
import type { Prisma } from "@/generated/prisma/client";

// Operational scheduling is also the authoritative check-in schedule.
// Never pass a workspace snapshot or registration form to Reception.
export async function getOperationalEvent(
  tx: Prisma.TransactionClient,
  eventId: string,
) {
  return tx.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      timezone: true,
      startsAt: true,
      endsAt: true,
      cancelledAt: true,
      archivedAt: true,
    },
  });
}
