import "server-only";
import type { EventLanguage } from "@/features/events/event-language";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { prisma } from "@/lib/prisma";

export async function getPublicEvents(language?: EventLanguage) {
  const events = await prisma.event.findMany({
    where: {
      cancelledAt: null,
      publicId: { not: null },
      publishedRevision: {
        is: {
          AND: [
            { snapshot: { path: ["visibility"], equals: "PUBLIC" } },
            ...(language
              ? [{ snapshot: { path: ["language"], equals: language } }]
              : []),
          ],
        },
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
      result.data.visibility !== "PUBLIC" ||
      (language !== undefined && result.data.language !== language)
    ) {
      return [];
    }

    const snapshot = result.data;

    // Only catalog presentation data crosses the client boundary.
    return [
      {
        publicId: event.publicId,
        snapshot: {
          title: snapshot.title,
          language: snapshot.language,
          description: snapshot.description,
          descriptionFormat: snapshot.descriptionFormat,
          startsAt: snapshot.startsAt,
          endsAt: snapshot.endsAt,
          timezone: snapshot.timezone,
          registrationOpensAt: snapshot.registrationOpensAt,
          registrationClosesAt: snapshot.registrationClosesAt,
          cover: snapshot.cover
            ? {
                assetId: snapshot.cover.assetId,
                alt: snapshot.cover.alt,
                variants: {
                  "640": { width: snapshot.cover.variants["640"].width },
                  "1280": {
                    width: snapshot.cover.variants["1280"].width,
                    height: snapshot.cover.variants["1280"].height,
                  },
                  "1920": { width: snapshot.cover.variants["1920"].width },
                },
              }
            : null,
        },
      },
    ];
  });

  return published.sort(
    (a, b) =>
      Date.parse(a.snapshot.startsAt) - Date.parse(b.snapshot.startsAt) ||
      a.publicId.localeCompare(b.publicId),
  );
}
