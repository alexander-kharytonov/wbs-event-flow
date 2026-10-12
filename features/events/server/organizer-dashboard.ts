import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

// Called only with the verified session identity, in a single read snapshot.
export async function readOrganizerDashboard(
  db: Prisma.TransactionClient,
  userId: string,
  now: Date,
) {
  const owned = { organizer: { userId } };
  const scheduled = { ...owned, cancelledAt: null };
  const actionable = {
    ...scheduled,
    archivedAt: null,
    endsAt: { gt: now },
  };
  // Review also forbids reviewing one's own historical linked application.
  const pending = {
    status: "PENDING" as const,
    OR: [{ userId: null }, { userId: { not: userId } }],
  };
  const organizer = await db.organizerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  const assigned = await db.eventStaff.findFirst({
    where: { userId, event: { organizer: { userId: { not: userId } } } },
    select: { eventId: true },
  });
  const upcomingCount = await db.event.count({
    where: { ...scheduled, startsAt: { gt: now } },
  });
  const ongoingCount = await db.event.count({
    where: { ...scheduled, startsAt: { lte: now }, endsAt: { gt: now } },
  });
  const completedCount = await db.event.count({
    where: { ...scheduled, endsAt: { lte: now } },
  });
  const groups = await db.application.groupBy({
    by: ["eventId"],
    where: { ...pending, event: actionable },
    _count: { _all: true },
  });
  const counts = new Map(
    groups.map((group) => [group.eventId, group._count._all]),
  );
  const attention = await db.event.findMany({
    where: { ...actionable, id: { in: groups.map((group) => group.eventId) } },
    select: { id: true, title: true },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
  const upcoming = await db.event.findMany({
    where: { ...scheduled, archivedAt: null, startsAt: { gt: now } },
    take: 5,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      publicId: true,
      contentVersion: true,
      publishedRevision: { select: { contentVersion: true } },
    },
  });
  const nextEnd = await db.event.aggregate({
    where: { ...scheduled, startsAt: { lte: now }, endsAt: { gt: now } },
    _min: { endsAt: true },
  });
  const boundaries = [upcoming[0]?.startsAt, nextEnd._min.endsAt]
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    canCreate: Boolean(organizer),
    hasStaffEvents: Boolean(assigned),
    metrics: {
      upcoming: upcomingCount,
      ongoing: ongoingCount,
      completed: completedCount,
      pending: groups.reduce((total, group) => total + group._count._all, 0),
    },
    attention: attention.map((event) => ({
      ...event,
      pending: counts.get(event.id) ?? 0,
    })),
    upcoming: upcoming.map((event) => ({
      ...event,
      pending: counts.get(event.id) ?? 0,
    })),
    boundaryAt: boundaries[0]?.toISOString() ?? null,
  };
}

export async function getOrganizerDashboard() {
  const user = await requireVerifiedUser();

  return prisma.$transaction(
    async (tx) => {
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`
      SELECT clock_timestamp()::timestamptz(3) AS now
    `;

      return readOrganizerDashboard(tx, user.id, now);
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export type OrganizerDashboardData = Awaited<
  ReturnType<typeof getOrganizerDashboard>
>;
