import "server-only";
import { hasEventPermission } from "@/features/events/server/event-access";
import type { Prisma } from "@/generated/prisma/client";

export async function readStaffEvents(
  db: Prisma.TransactionClient,
  userId: string,
) {
  const assigned = await db.eventStaff.findMany({
    where: { userId, event: { organizer: { userId: { not: userId } } } },
    select: {
      role: true,
      event: {
        select: {
          id: true,
          title: true,
          language: true,
          startsAt: true,
          endsAt: true,
          timezone: true,
          cancelledAt: true,
          archivedAt: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { eventId: "desc" }],
  });

  return assigned
    .filter(({ role }) => hasEventPermission(role, "event.context.read"))
    .map(({ event, role }) => ({ ...event, role }));
}
