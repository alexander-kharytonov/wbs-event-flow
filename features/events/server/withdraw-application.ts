import "server-only";
import { z } from "zod";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { prisma } from "@/lib/prisma";

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
        const events = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Event" WHERE "publicId" = ${publicId}::uuid FOR UPDATE`;
        const eventId = events[0]?.id;

        if (!eventId) {
          return unavailable;
        }

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
        const now = new Date();

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
