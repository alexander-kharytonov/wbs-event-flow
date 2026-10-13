import "server-only";
import { z } from "zod";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { verifyEventPassword } from "@/features/events/server/event-password";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { prisma } from "@/lib/prisma";

export async function verifyPublishedEventPassword(
  publicId: string,
  password: string,
) {
  if (!z.uuid().safeParse(publicId).success) {
    return null;
  }

  return prisma.$transaction(
    async (tx) => {
      // The same lock serializes failures, verification, publication and revocation.
      await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
      const event = await lockEventForUpdate(tx, { publicId });

      if (!event?.publishedRevisionId) {
        return null;
      }
      const revision = await tx.eventRevision.findUniqueOrThrow({
        where: { id: event.publishedRevisionId },
      });
      const snapshot = eventSnapshotSchema.safeParse(revision.snapshot);

      if (
        !snapshot.success ||
        snapshot.data.visibility !== "PRIVATE" ||
        !revision.passwordHash ||
        !revision.passwordGrantId ||
        (snapshot.data.cover?.assetId ?? null) !== revision.coverAssetId
      ) {
        return null;
      }
      const now = event.decisionNow;
      const activeWindow =
        event.passwordFailureWindow &&
        now.getTime() < event.passwordFailureWindow.getTime() + 15 * 60 * 1000;
      const failures = activeWindow ? event.passwordFailures : 0;

      if (failures >= 100) {
        return null;
      }

      if (await verifyEventPassword(password, revision.passwordHash)) {
        // Success never clears or renews the event-wide failure window.
        return { grantId: revision.passwordGrantId, issuedAt: now.getTime() };
      }
      await tx.event.update({
        where: { id: event.id },
        data: {
          passwordFailures: failures + 1,
          passwordFailureWindow: activeWindow
            ? event.passwordFailureWindow
            : now,
          updatedAt: event.updatedAt,
        },
      });

      return null;
    },
    { isolationLevel: "ReadCommitted", timeout: 10000 },
  );
}
