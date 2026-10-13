import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eventLifecycle } from "@/features/events/event-lifecycle";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import {
  buildEventSnapshot,
  workspaceInclude,
} from "@/features/events/server/build-event-snapshot";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { lockMediaAsset } from "@/features/events/server/media-assets";
import { Prisma } from "@/generated/prisma/client";
import type { Messages } from "@/lib/i18n/messages";
import { prisma } from "@/lib/prisma";
import { notifyEventChanged } from "@/lib/realtime/application-notifications";

const publishInput = z.strictObject({
  eventId: z.uuid(),
  contentVersion: z.number().int().positive(),
});

export type PublishResult = {
  message?: keyof Messages["events"];
  conflict?: boolean;
  success?: boolean;
};

export async function publishOwnedEvent(
  organizerId: string,
  input: unknown,
): Promise<PublishResult> {
  const parsed = publishInput.safeParse(input);

  if (!parsed.success) {
    return { message: "publishReload" };
  }

  const { eventId, contentVersion } = parsed.data;

  try {
    return await prisma.$transaction(
      async (tx) => {
        // All form writes lock Event first. Event edits acquire the same row lock.
        // Lock before loading relations, so every snapshot query sees one workspace.
        const owned = await lockEventForUpdate(tx, {
          id: eventId,
          organizerId,
        });

        if (!owned) {
          return { message: "publishUnavailable" };
        }

        const lifecycle = eventLifecycle(owned, owned.decisionNow);
        const everPublished = await tx.eventRevision.findFirst({
          where: { eventId },
          select: { id: true },
        });

        if (
          owned.archivedAt ||
          lifecycle === "Cancelled" ||
          lifecycle === "Completed" ||
          (!everPublished && lifecycle !== "Upcoming")
        ) {
          return {
            message: "publishLifecycle",
          };
        }

        const event = await tx.event.findUniqueOrThrow({
          where: { id: eventId },
          include: workspaceInclude,
        });

        if (event.contentVersion !== contentVersion) {
          return {
            conflict: true,
            message: "publishConflict",
          };
        }

        const currentSnapshot = eventSnapshotSchema.safeParse(
          event.publishedRevision?.snapshot,
        );

        if (
          event.publishedRevision?.contentVersion === contentVersion &&
          currentSnapshot.success &&
          (currentSnapshot.data.cover?.assetId ?? null) ===
            event.publishedRevision.coverAssetId
        ) {
          return { success: true };
        }

        if (!event.registrationForm) {
          return { message: "publishFormUnavailable" };
        }

        const snapshot = buildEventSnapshot(event);

        if (!snapshot.success) {
          return {
            message: "publishCheckDetails",
          };
        }

        if (event.coverAssetId) {
          const asset = await lockMediaAsset(tx, event.coverAssetId);

          if (
            asset?.state !== "READY" ||
            asset.organizerId !== event.organizerId ||
            asset.eventId !== eventId
          ) {
            return {
              message: "publishCoverUnavailable",
            };
          }
        }

        const latest = await tx.eventRevision.findFirst({
          where: { eventId },
          orderBy: { number: "desc" },
          select: { number: true, passwordHash: true, passwordGrantId: true },
        });
        const previousAccess = event.publishedRevision ?? latest;
        const now = owned.decisionNow;
        const revision = await tx.eventRevision.create({
          data: {
            eventId,
            number: (latest?.number ?? 0) + 1,
            contentVersion,
            coverAssetId: event.coverAssetId,
            snapshot: snapshot.data,
            passwordHash: event.draftPasswordHash,
            passwordGrantId: event.draftPasswordHash
              ? previousAccess?.passwordHash === event.draftPasswordHash
                ? (previousAccess?.passwordGrantId ?? randomUUID())
                : randomUUID()
              : null,
            publishedAt: now,
          },
        });
        const publicId =
          event.publicId ??
          (await tx.$queryRaw<{ id: string }[]>`SELECT uuidv7()::text AS id`)[0]
            .id;
        await tx.event.update({
          where: { id: eventId },
          data: {
            publishedRevisionId: revision.id,
            publicId,
            publishedAt: event.publishedAt ?? now,
            // Publication is not a workspace edit; preserve its concurrency token.
            updatedAt: event.updatedAt,
          },
        });

        await notifyEventChanged(tx, eventId);

        return { success: true };
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return {
        conflict: true,
        message: "publishChanged",
      };
    }

    return { message: "publishFailed" };
  }
}
