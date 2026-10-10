import "server-only";
import {
  lockMediaAsset,
  mediaIsReferenced,
  unusedGraceMs,
  uploadLifetimeMs,
} from "@/features/events/server/media-assets";
import { mediaStorage } from "@/lib/media-storage";
import { prisma } from "@/lib/prisma";

export const mediaCleanupBudget = { assets: 100, orphanFiles: 100 } as const;

export async function cleanupMedia() {
  // Reject an unsafe DB-storage configuration before claiming rows.
  const storage = mediaStorage();
  await storage.validate();
  const result = {
    deleted: 0,
    orphans: 0,
    failed: 0,
    candidates: 0,
    dbBudgetReached: false,
    orphanBudgetReached: false,
  };
  const [clock] = await prisma.$queryRaw<
    { now: Date }[]
  >`SELECT clock_timestamp() AS now`;
  const batch = await prisma.mediaAsset.findMany({
    where: {
      draftEvents: { none: {} },
      revisions: { none: {} },
      OR: [
        { state: "DELETING" },
        { state: "UPLOADING", uploadExpiresAt: { lte: clock.now } },
        {
          state: "READY",
          unusedSince: { lte: new Date(clock.now.getTime() - unusedGraceMs) },
        },
      ],
    },
    orderBy: { id: "asc" },
    take: mediaCleanupBudget.assets,
    select: { id: true },
  });
  result.candidates = batch.length;
  result.dbBudgetReached = batch.length === mediaCleanupBudget.assets;

  for (const candidate of batch) {
    try {
      const deleting = await prisma.$transaction(
        async (tx) => {
          const asset = await lockMediaAsset(tx, candidate.id);

          if (!asset || (await mediaIsReferenced(tx, asset.id))) {
            return null;
          }

          const [clock] = await tx.$queryRaw<
            { now: Date }[]
          >`SELECT clock_timestamp() AS now`;
          const expired =
            asset.state === "UPLOADING" && asset.uploadExpiresAt <= clock.now;
          const unused =
            asset.state === "READY" &&
            asset.unusedSince &&
            asset.unusedSince.getTime() <= clock.now.getTime() - unusedGraceMs;

          if (!expired && !unused && asset.state !== "DELETING") {
            return null;
          }

          return tx.mediaAsset.update({
            where: { id: asset.id },
            data: {
              state: "DELETING",
              deletingAt: asset.deletingAt ?? clock.now,
            },
          });
        },
        { isolationLevel: "ReadCommitted" },
      );

      if (!deleting) {
        continue;
      }

      await mediaStorage(deleting.backend).remove(deleting.storageKey);
      const deleted = await prisma.$transaction(async (tx) => {
        const asset = await lockMediaAsset(tx, deleting.id);

        if (
          asset?.state !== "DELETING" ||
          (await mediaIsReferenced(tx, asset.id))
        ) {
          return false;
        }

        await tx.mediaAsset.delete({ where: { id: asset.id } });

        return true;
      });

      if (deleted) {
        result.deleted += 1;
      }
    } catch {
      result.failed += 1;
    }
  }

  // One streaming pass, constant retained memory. O(F) traversal/lookup time is
  // an accepted v1 limitation. Count deletion attempts, including failed ones.
  let orphanAttempts = 0;
  const olderThan = new Date(clock.now.getTime() - uploadLifetimeMs);

  for await (const file of storage.list()) {
    if (file.modifiedAt > olderThan) {
      continue;
    }

    const tracked = await prisma.mediaAsset.findUnique({
      where: { storageKey: file.key },
      select: { id: true },
    });

    if (tracked) {
      continue;
    }

    orphanAttempts += 1;

    try {
      // Keys are never reused and a DB record always precedes upload writes.
      // Delete only this aged file, not newer siblings of a late upload.
      if (await storage.removeOrphan(file.name, olderThan)) {
        result.orphans += 1;
      }
    } catch {
      result.failed += 1;
    }

    if (orphanAttempts === mediaCleanupBudget.orphanFiles) {
      result.orphanBudgetReached = true;
      break;
    }
  }

  return result;
}
