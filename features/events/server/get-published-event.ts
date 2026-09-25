import "server-only";
import { cache } from "react";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { prisma } from "@/lib/prisma";

// Request-scoped deduplication keeps metadata and content on the same revision.
export const getPublishedEvent = cache(async (publicId: string) => {
  const event = await prisma.event.findUnique({
    where: { publicId },
    select: { publishedRevision: { select: { snapshot: true } } },
  });
  const snapshot = eventSnapshotSchema.safeParse(
    event?.publishedRevision?.snapshot,
  );

  return snapshot.success ? snapshot.data : null;
});
