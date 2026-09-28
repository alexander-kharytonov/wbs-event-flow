import "server-only";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { prisma } from "@/lib/prisma";

export async function getPublicEvents() {
  const events = await prisma.event.findMany({
    where: {
      cancelledAt: null,
      publicId: { not: null },
      publishedRevision: {
        is: { snapshot: { path: ["visibility"], equals: "PUBLIC" } },
      },
    },
    select: {
      publicId: true,
      publishedRevision: { select: { snapshot: true } },
    },
  });
  const published = events.flatMap((event) => {
    const result = eventSnapshotSchema.safeParse(
      event.publishedRevision?.snapshot,
    );

    if (
      !event.publicId ||
      !result.success ||
      result.data.visibility !== "PUBLIC"
    ) {
      return [];
    }

    return [{ publicId: event.publicId, snapshot: result.data }];
  });

  return published.sort(
    (a, b) =>
      Date.parse(a.snapshot.startsAt) - Date.parse(b.snapshot.startsAt) ||
      a.publicId.localeCompare(b.publicId),
  );
}
