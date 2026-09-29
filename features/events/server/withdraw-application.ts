import "server-only";
import { z } from "zod";
import { applicationsFrozen } from "@/features/events/event-lifecycle";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { prisma } from "@/lib/prisma";
import { notifyApplicationChanged } from "@/lib/realtime/application-notifications";

const withdrawalInput = z.strictObject({
  publicId: z.uuid(),
  applicationId: z.uuid(),
});

export type WithdrawalResult = { success?: true; message?: string };

export async function withdrawOwnApplication(
  userId: string,
  input: unknown,
): Promise<WithdrawalResult> {
  const parsed = withdrawalInput.safeParse(input);
  const unavailable = {
    message: "This application is unavailable for withdrawal.",
  };

  if (!parsed.success) {
    return unavailable;
  }

  const { publicId, applicationId } = parsed.data;

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Serialize with publication, organizer review and submission.
        const locked = await lockEventForUpdate(tx, { publicId });

        if (!locked || applicationsFrozen(locked, locked.decisionNow)) {
          return unavailable;
        }

        const eventId = locked.id;

        const application = await tx.application.findFirst({
          where: { id: applicationId, eventId, userId },
          select: { status: true, updatedAt: true },
        });

        if (!application) {
          return unavailable;
        }

        if (application.status === "WITHDRAWN") {
          return { success: true };
        }

        if (
          application.status !== "PENDING" &&
          application.status !== "APPROVED"
        ) {
          return unavailable;
        }

        const event = await tx.event.findUniqueOrThrow({
          where: { id: eventId },
          select: { publishedRevision: { select: { snapshot: true } } },
        });
        const snapshot = eventSnapshotSchema.safeParse(
          event.publishedRevision?.snapshot,
        );
        const now = locked.decisionNow;

        if (
          !snapshot.success ||
          now.getTime() >= Date.parse(snapshot.data.endsAt)
        ) {
          return {
            message:
              "Applications cannot be withdrawn after the event has ended.",
          };
        }

        await tx.application.update({
          where: {
            id: applicationId,
            userId,
            status: { in: ["PENDING", "APPROVED"] },
          },
          data: {
            status: "WITHDRAWN",
            withdrawnAt: now,
            updatedAt: application.updatedAt,
          },
        });

        if (application.status === "APPROVED") {
          const revoked = await tx.registration.updateMany({
            where: {
              eventId,
              sourceApplicationId: applicationId,
              revokedAt: null,
            },
            data: { revokedAt: now },
          });

          if (revoked.count !== 1) {
            throw new Error(
              "Approved application must have exactly one active registration.",
            );
          }
        }

        await notifyApplicationChanged(tx, { eventId, userId });

        return { success: true };
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch {
    return {
      message: "Could not withdraw your application. Please try again.",
    };
  }
}
