import type { Metadata } from "next";
import { eventDescriptionText } from "@/features/events/components/event-description";
import type { getPublishedEvent } from "@/features/events/server/get-published-event";

export function publicEventMetadata(
  published: NonNullable<Awaited<ReturnType<typeof getPublishedEvent>>>,
  publicId: string,
  origin: string,
): Metadata {
  const { snapshot, cancelledAt, archived } = published;
  const title = `${snapshot.title} | Event Flow`;
  const description =
    eventDescriptionText(
      snapshot.description ?? "",
      snapshot.descriptionFormat,
    ).slice(0, 160) ||
    "Event details and registration information on Event Flow.";
  const url = new URL(`/e/${encodeURIComponent(publicId)}`, origin).href;
  const isPublic = snapshot.visibility === "PUBLIC";
  const cover = snapshot.cover;
  const image = cover
    ? {
        url: new URL(
          `/e/${encodeURIComponent(publicId)}/cover/${cover.assetId}/social`,
          origin,
        ).href,
        width: cover.variants.social.width,
        height: cover.variants.social.height,
        alt: cover.alt ?? "",
        type: cover.variants.social.contentType,
      }
    : null;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: isPublic && !cancelledAt && !archived, follow: isPublic },
    openGraph: isPublic
      ? {
          type: "website",
          title,
          description,
          url,
          siteName: "Event Flow",
          images: image ? [image] : [],
        }
      : null,
    twitter: isPublic
      ? {
          card: image ? "summary_large_image" : "summary",
          title,
          description,
          images: image ? [image] : [],
        }
      : null,
  };
}
