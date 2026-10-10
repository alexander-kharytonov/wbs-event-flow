import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  mediaManifestSchema,
  mediaVariants,
} from "@/features/events/schemas/event-rich-content";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { MediaError } from "@/features/events/server/media-image";
import { auth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { mediaStorage } from "@/lib/media-storage";
import { prisma } from "@/lib/prisma";

export const mediaHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
};

export function mediaFailure(error: unknown) {
  return Response.json(
    {
      message:
        error instanceof MediaError
          ? error.message
          : "Media is unavailable. Please try again.",
    },
    {
      status: error instanceof MediaError ? error.status : 503,
      headers: mediaHeaders,
    },
  );
}

export async function mediaActor(request: Request, mutation = false) {
  if (
    mutation &&
    request.headers.get("origin") !== getServerEnv().BETTER_AUTH_URL
  ) {
    throw new MediaError(403, "This request origin is not allowed.");
  }

  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true, disableRefresh: true },
  });

  if (
    !session?.user.emailVerified ||
    session.session.expiresAt.getTime() <= Date.now()
  ) {
    throw new MediaError(404, "Event media unavailable.");
  }

  return session.user.id;
}

export function requireMediaId(id: string) {
  if (!z.uuid().safeParse(id).success) {
    throw new MediaError(404, "Event media unavailable.");
  }
}

export async function serveEventMedia(
  request: Request,
  context: {
    eventId?: string;
    publicId?: string;
    assetId: string;
    variant: string;
  },
) {
  const { assetId, variant } = context;
  requireMediaId(assetId);
  const parsedVariant = z.enum(mediaVariants).safeParse(variant);

  if (!parsedVariant.success) {
    throw new MediaError(404, "Event media unavailable.");
  }

  const userId = context.eventId ? await mediaActor(request) : null;
  requireMediaId(context.eventId ?? context.publicId ?? "");
  const asset = await prisma.$transaction(
    async (tx) => {
      if (context.eventId) {
        const actor = await authorizeEventActor(
          tx,
          context.eventId,
          userId ?? "",
          "event.preview",
        );

        if (actor?.role !== "OWNER") {
          throw new MediaError(404, "Event media unavailable.");
        }

        // Event-bound READY uploads may be previewed before explicit attachment.
        return tx.mediaAsset.findFirst({
          where: {
            id: assetId,
            eventId: context.eventId,
            state: "READY",
            organizer: { userId: userId ?? "" },
            event: { organizer: { userId: userId ?? "" } },
          },
        });
      }

      const event = await tx.event.findUnique({
        where: { publicId: context.publicId },
        select: {
          id: true,
          organizerId: true,
          publishedRevision: {
            select: { coverAssetId: true, snapshot: true, coverAsset: true },
          },
        },
      });
      const revision = event?.publishedRevision;
      const snapshot = eventSnapshotSchema.safeParse(revision?.snapshot);
      const publishedAsset = revision?.coverAsset;

      if (
        !snapshot.success ||
        snapshot.data.schemaVersion !== 3 ||
        snapshot.data.cover?.assetId !== assetId ||
        revision?.coverAssetId !== assetId ||
        !publishedAsset ||
        publishedAsset.eventId !== event?.id ||
        publishedAsset.organizerId !== event?.organizerId ||
        publishedAsset.state !== "READY"
      ) {
        throw new MediaError(404, "Event media unavailable.");
      }

      const manifest = mediaManifestSchema.safeParse(publishedAsset.manifest);

      if (
        !manifest.success ||
        JSON.stringify(manifest.data) !==
          JSON.stringify(snapshot.data.cover.variants)
      ) {
        throw new MediaError(404, "Event media unavailable.");
      }

      return publishedAsset;
    },
    { isolationLevel: "RepeatableRead" },
  );

  if (!asset) {
    throw new MediaError(404, "Event media unavailable.");
  }

  const manifest = mediaManifestSchema.parse(asset.manifest);
  const descriptor = manifest[parsedVariant.data];
  const bytes = await mediaStorage(asset.backend).read(
    asset.storageKey,
    parsedVariant.data,
  );

  if (
    bytes.length !== descriptor.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== descriptor.sha256
  ) {
    throw new MediaError(503, "Media is temporarily unavailable.");
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      ...mediaHeaders,
      "Content-Type": descriptor.contentType,
      "Content-Length": String(bytes.length),
    },
  });
}
