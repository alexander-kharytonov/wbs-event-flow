import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { eventDescriptionText } from "@/features/events/components/event-description";
import type { getPublishedEvent } from "@/features/events/server/get-published-event";

export async function publicEventMetadata(
  published: NonNullable<Awaited<ReturnType<typeof getPublishedEvent>>>,
  publicId: string,
  origin: string,
): Promise<Metadata> {
  const t = await getTranslations("events");
  const { snapshot, cancelledAt, archived } = published;
  const title = `${snapshot.title} | Event Flow`;
  const description =
    eventDescriptionText(
      snapshot.description ?? "",
      snapshot.descriptionFormat,
    ).slice(0, 160) || t("publicMetadataFallback");
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
