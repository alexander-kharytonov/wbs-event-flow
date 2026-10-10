import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { workspaceReadOnly } from "@/features/events/event-lifecycle";
import { mediaManifestSchema } from "@/features/events/schemas/event-rich-content";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import {
  MediaError,
  normalizeImage,
  readUpload,
  withImageSlot,
} from "@/features/events/server/media-image";
import type { MediaAsset, Prisma } from "@/generated/prisma/client";
import { mediaStorage } from "@/lib/media-storage";
import { prisma } from "@/lib/prisma";
import { notifyEventChanged } from "@/lib/realtime/application-notifications";

export const uploadLifetimeMs = 24 * 60 * 60 * 1000;
export const unusedGraceMs = 7 * uploadLifetimeMs;

export async function lockMediaAsset(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<
    MediaAsset[]
  >`SELECT * FROM "MediaAsset" WHERE id = ${id}::uuid FOR UPDATE`;

  return rows[0] ?? null;
}

export async function mediaIsReferenced(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const draft = await tx.event.findFirst({
    where: { coverAssetId: id },
    select: { id: true },
  });
  const revision = await tx.eventRevision.findFirst({
    where: { coverAssetId: id },
    select: { id: true },
  });

  return Boolean(draft || revision);
}

async function lockEditableEvent(
  tx: Prisma.TransactionClient,
  userId: string,
  eventId: string,
) {
  const event = await lockEventForUpdate(tx, { id: eventId });
  const actor =
    event && (await authorizeEventActor(tx, eventId, userId, "event.edit"));

  if (!event || actor?.role !== "OWNER") {
    throw new MediaError(404, "Event media unavailable.");
  }

  if (workspaceReadOnly(event, event.decisionNow)) {
    throw new MediaError(409, "This event is read-only.");
  }

  return event;
}

export async function uploadEventCover(
  userId: string,
  eventId: string,
  request: Request,
) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    throw new MediaError(415, "Upload JPEG, PNG or WebP image bytes.");
  }

  return withImageSlot(async () => {
    const asset = await prisma.$transaction(
      async (tx) => {
        const event = await lockEditableEvent(tx, userId, eventId);
        // Serialize new-upload admission across Events/processes. Detach may
        // increase this count above ten; it is not a global count invariant.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`event-media:${event.organizerId}`}, 0))`;
        const pending = await tx.mediaAsset.count({
          where: {
            organizerId: event.organizerId,
            OR: [
              { state: "UPLOADING" },
              {
                state: "READY",
                draftEvents: { none: {} },
                revisions: { none: {} },
              },
            ],
          },
        });

        if (pending >= 10) {
          throw new MediaError(
            429,
            "You have at least 10 pending uploads. Attach an image or run media cleanup after its retention period.",
          );
        }

        return tx.mediaAsset.create({
          data: {
            organizerId: event.organizerId,
            eventId,
            storageKey: randomBytes(16).toString("hex"),
            createdAt: event.decisionNow,
            uploadExpiresAt: new Date(
              event.decisionNow.getTime() + uploadLifetimeMs,
            ),
          },
        });
      },
      { isolationLevel: "ReadCommitted" },
    );

    // A failed/uncertain request leaves a tracked record for cleanup; never delete
    // files based on an uncertain DB commit outcome.
    const bytes = await readUpload(request);
    const image = await normalizeImage(bytes, contentType);
    const storage = mediaStorage(asset.backend);

    for (const [variant, data] of image.variants) {
      const active = await prisma.mediaAsset.findUnique({
        where: { id: asset.id },
        select: { state: true, uploadExpiresAt: true },
      });

      if (
        active?.state !== "UPLOADING" ||
        active.uploadExpiresAt.getTime() <= Date.now()
      ) {
        throw new MediaError(409, "This upload has expired.");
      }

      await storage.write(asset.storageKey, variant, data);
    }

    await prisma.$transaction(
      async (tx) => {
        const event = await lockEditableEvent(tx, userId, eventId);
        const current = await lockMediaAsset(tx, asset.id);

        if (
          current?.state !== "UPLOADING" ||
          current.eventId !== event.id ||
          current.organizerId !== event.organizerId ||
          current.uploadExpiresAt <= event.decisionNow
        ) {
          throw new MediaError(409, "This upload is no longer available.");
        }

        await tx.mediaAsset.update({
          where: { id: asset.id },
          data: {
            state: "READY",
            manifest: image.manifest,
            readyAt: event.decisionNow,
            unusedSince: event.decisionNow,
          },
        });
      },
      { isolationLevel: "ReadCommitted" },
    );

    return { assetId: asset.id, variants: image.manifest };
  });
}

const attachmentSchema = z.strictObject({
  assetId: z.uuid().nullable(),
  alt: z.string().trim().max(500).nullable(),
  version: z.string().max(100),
});

export async function attachEventCover(
  userId: string,
  eventId: string,
  input: unknown,
) {
  const parsed = attachmentSchema.safeParse(input);

  if (
    !parsed.success ||
    (parsed.data.assetId === null && parsed.data.alt !== null)
  ) {
    throw new MediaError(
      400,
      "Check the cover, alternative text and event version.",
    );
  }

  const { assetId, alt, version } = parsed.data;
  const timestamp = Buffer.from(version, "base64url").toString("utf8");
  const updatedAt = new Date(timestamp);

  if (
    !Number.isFinite(updatedAt.getTime()) ||
    updatedAt.toISOString() !== timestamp ||
    Buffer.from(timestamp).toString("base64url") !== version
  ) {
    throw new MediaError(400, "Reload the event before saving its cover.");
  }

  return prisma.$transaction(
    async (tx) => {
      const event = await lockEditableEvent(tx, userId, eventId);

      if (event.updatedAt.getTime() !== updatedAt.getTime()) {
        throw new MediaError(
          409,
          "The event changed. Reload before saving its cover.",
        );
      }

      // Stable ordering also covers replacement's old and new assets.
      const assets = new Map<string, MediaAsset>();

      for (const id of [
        ...new Set(
          [event.coverAssetId, assetId].filter(
            (id): id is string => id !== null,
          ),
        ),
      ].sort()) {
        const asset = await lockMediaAsset(tx, id);

        if (asset) {
          assets.set(id, asset);
        }
      }

      if (assetId) {
        const asset = assets.get(assetId);

        if (
          asset?.state !== "READY" ||
          asset.organizerId !== event.organizerId ||
          asset.eventId !== eventId ||
          !mediaManifestSchema.safeParse(asset.manifest).success
        ) {
          throw new MediaError(
            409,
            "This cover is unavailable for attachment.",
          );
        }
      }

      if (event.coverAssetId === assetId && event.coverAlt === alt) {
        return { version, contentVersion: event.contentVersion };
      }

      const nextVersion = new Date(
        Math.max(event.decisionNow.getTime(), updatedAt.getTime() + 1),
      );
      await tx.event.update({
        where: { id: eventId },
        data: {
          coverAssetId: assetId,
          coverAlt: alt,
          contentVersion: { increment: 1 },
          updatedAt: nextVersion,
        },
      });

      if (assetId) {
        await tx.mediaAsset.update({
          where: { id: assetId },
          data: { unusedSince: null },
        });
      }

      if (
        event.coverAssetId &&
        event.coverAssetId !== assetId &&
        !(await mediaIsReferenced(tx, event.coverAssetId))
      ) {
        await tx.mediaAsset.update({
          where: { id: event.coverAssetId },
          data: { unusedSince: event.decisionNow },
        });
      }

      await notifyEventChanged(tx, eventId);

      return {
        version: Buffer.from(nextVersion.toISOString()).toString("base64url"),
        contentVersion: event.contentVersion + 1,
      };
    },
    { isolationLevel: "ReadCommitted" },
  );
}

// Called under the Event lock before deleting a pristine draft. Its upload rows
// survive with eventId=null, so files remain tracked until the grace period ends.
export async function releaseDeletedEventMedia(
  tx: Prisma.TransactionClient,
  eventId: string,
  now: Date,
) {
  const assets = await tx.mediaAsset.findMany({
    where: { eventId },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  for (const asset of assets) {
    await lockMediaAsset(tx, asset.id);
    await tx.mediaAsset.update({
      where: { id: asset.id },
      data: { unusedSince: now },
    });
  }
}
