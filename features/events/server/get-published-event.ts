import "server-only";
import { cache } from "react";
import { z } from "zod";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { prisma } from "@/lib/prisma";

// Request-scoped deduplication keeps metadata and content on the same revision.
export const getPublishedEvent = cache(async (publicId: string) => {
  if (!z.uuid().safeParse(publicId).success) {
    return null;
  }

  const event = await prisma.event.findUnique({
    where: { publicId },
    select: {
      cancelledAt: true,
      archivedAt: true,
      cancellationReason: true,
      endsAt: true,
      publishedRevision: {
        select: { id: true, snapshot: true, coverAssetId: true },
      },
    },
  });
  const snapshot = eventSnapshotSchema.safeParse(
    event?.publishedRevision?.snapshot,
  );

  return snapshot.success &&
    event?.publishedRevision &&
    (snapshot.data.schemaVersion !== 3 ||
      (snapshot.data.cover?.assetId ?? null) ===
        event.publishedRevision.coverAssetId)
    ? {
        snapshot: snapshot.data,
        eventRevisionId: event.publishedRevision.id,
        cancelledAt: event.cancelledAt,
        archived: Boolean(event.archivedAt),
        cancellationReason: event.cancellationReason,
        lifecycleEndsAt: event.endsAt,
      }
    : null;
});
