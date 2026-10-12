import { OrganizerEventResults } from "@/features/events/components/organizer-event-results";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export async function OrganizerEventList() {
  const user = await requireVerifiedUser();
  const organizer = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  const events = await prisma.event.findMany({
    where: {
      organizer: { userId: user.id },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      publicId: true,
      title: true,
      language: true,
      coverAssetId: true,
      coverAlt: true,
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

  return (
    <OrganizerEventResults
      events={events.map((event) => ({ ...event, role: "OWNER" as const }))}
      canCreate={Boolean(organizer)}
    />
  );
}
