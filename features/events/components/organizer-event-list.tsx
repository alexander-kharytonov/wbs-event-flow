import { OrganizerEventResults } from "@/features/events/components/organizer-event-results";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export async function OrganizerEventList() {
  const organizer = await requireOrganizer();
  const events = await prisma.event.findMany({
    where: {
      organizerId: organizer.id,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      publicId: true,
      title: true,
      visibility: true,
      startsAt: true,
      endsAt: true,
      cancelledAt: true,
      archivedAt: true,
      timezone: true,
      contentVersion: true,
      publishedRevision: { select: { contentVersion: true } },
    },
  });

  return <OrganizerEventResults events={events} />;
}
