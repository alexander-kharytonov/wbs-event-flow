import "server-only";
import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import {
  mediaManifestSchema,
  mediaVariants,
} from "@/features/events/schemas/event-rich-content";
import { lockMediaAsset } from "@/features/events/server/media-assets";
import { MediaError } from "@/features/events/server/media-image";
import type { Prisma } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";
import { mediaStorage } from "@/lib/media-storage";
import { prisma } from "@/lib/prisma";

const creationSchema = z
  .strictObject({
    key: z.uuid(),
    assetId: z.uuid().nullable(),
    alt: z.string().trim().max(500).nullable(),
  })
  .refine((value) => value.assetId !== null || value.alt === null);
const resultSchema = z.strictObject({
  eventId: z.uuid(),
  addedCount: z.number().int().nonnegative(),
  skippedEmails: z.array(z.string()),
  duplicateWarnings: z.array(z.string()),
});

export type CreationResult = z.infer<typeof resultSchema>;

export function creationInput(formData: FormData) {
  return {
    key: formData.get("creationKey"),
    assetId: formData.get("temporaryCoverId") || null,
    alt: formData.get("temporaryCoverAlt") || null,
  };
}

// Only successful creations leave a receipt. Receipts survive pristine deletion,
// preventing old keys from creating another Event. No authoring payload is stored.
export async function createEventWithCover(
  organizerId: string,
  input: unknown,
  intent: unknown,
  create: (tx: Prisma.TransactionClient) => Promise<CreationResult>,
) {
  const parsed = creationSchema.safeParse(input);

  if (!parsed.success) {
    throw new MediaError(422, "creationInvalid");
  }
  const selection = parsed.data;
  // HMAC prevents the fingerprint from becoming a password guessing oracle.
  const fingerprint = createHmac("sha256", getServerEnv().BETTER_AUTH_SECRET)
    .update("event-creation\0")
    .update(JSON.stringify({ selection, intent }))
    .digest("hex");

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`event-create:${selection.key}`}, 0))`;
      const receipt = await tx.eventCreationReceipt.findUnique({
        where: { key: selection.key },
      });

      if (receipt) {
        if (
          receipt.organizerId !== organizerId ||
          receipt.fingerprint !== fingerprint ||
          !receipt.eventId
        ) {
          throw new MediaError(409, "creationInvalid");
        }

        return resultSchema.parse(receipt.result);
      }
      const organizer = await tx.organizerProfile.findUnique({
        where: { id: organizerId },
        select: { id: true },
      });

      if (!organizer) {
        throw new MediaError(404, "mediaUnavailable");
      }

      if (selection.assetId) {
        const asset = await lockMediaAsset(tx, selection.assetId);
        const [clock] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp() AS now`;

        if (
          asset?.state !== "READY" ||
          asset.organizerId !== organizerId ||
          asset.eventId !== null ||
          !asset.temporaryExpiresAt ||
          asset.temporaryExpiresAt <= clock.now
        ) {
          throw new MediaError(409, "creationCoverUnavailable");
        }
        const parsedManifest = mediaManifestSchema.safeParse(asset.manifest);

        if (!parsedManifest.success) {
          throw new MediaError(409, "creationCoverUnavailable");
        }
        const manifest = parsedManifest.data;
        const storage = mediaStorage(asset.backend);

        // Immutable files already exist. Holding the asset lock excludes cleanup
        // until the transaction establishes its reference. No files are moved or
        // deleted on rollback, including uncertain commit outcomes.
        for (const variant of mediaVariants) {
          const bytes = await storage
            .read(asset.storageKey, variant)
            .catch(() => {
              throw new MediaError(409, "creationCoverUnavailable");
            });
          const descriptor = manifest[variant];

          if (
            bytes.length !== descriptor.bytes ||
            createHash("sha256").update(bytes).digest("hex") !==
              descriptor.sha256
          ) {
            throw new MediaError(409, "creationCoverUnavailable");
          }
        }
      }
      const result = resultSchema.parse(await create(tx));

      if (selection.assetId) {
        await tx.mediaAsset.update({
          where: { id: selection.assetId },
          data: {
            eventId: result.eventId,
            temporaryExpiresAt: null,
            unusedSince: null,
          },
        });
        await tx.event.update({
          where: { id: result.eventId },
          data: { coverAssetId: selection.assetId, coverAlt: selection.alt },
        });
      }
      await tx.eventCreationReceipt.create({
        data: {
          key: selection.key,
          organizerId,
          eventId: result.eventId,
          fingerprint,
          result,
        },
      });

      return result;
    },
    { isolationLevel: "ReadCommitted", timeout: 15000 },
  );
}
