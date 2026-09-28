import "server-only";
import { z } from "zod";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import {
  emailEventSnapshot,
  enqueueApplicationEmail,
} from "@/lib/email-outbox/enqueue";
import { rejectionEventTitle } from "@/lib/email-outbox/payload";
import { prisma } from "@/lib/prisma";
import { notifyApplicationChanged } from "@/lib/realtime/application-notifications";

const reviewInput = z.strictObject({
  eventId: z.uuid(),
  applicationId: z.uuid(),
});

export type ReviewResult = {
  success?: boolean;
  code?:
    | "UNAVAILABLE"
    | "ALREADY_REVIEWED"
    | "CAPACITY_REACHED"
    | "PUBLICATION_UNAVAILABLE"
    | "FAILED";
  message?: string;
};

export async function reviewOwnedApplication(
  organizerId: string,
  input: unknown,
  decision: "APPROVED" | "REJECTED",
): Promise<ReviewResult> {
  const parsed = reviewInput.safeParse(input);
  const unavailable: ReviewResult = {
    code: "UNAVAILABLE",
    message: "This application is unavailable.",
  };

  if (!parsed.success) {
    return unavailable;
  }

  const { eventId, applicationId } = parsed.data;

  try {
    return await prisma.$transaction(
      async (tx) => {
        if (!(await lockEventForUpdate(tx, eventId, organizerId))) {
          return unavailable;
        }

        const application = await tx.application.findFirst({
          where: { id: applicationId, eventId },
          select: {
            status: true,
            updatedAt: true,
            userId: true,
            email: true,
            fullName: true,
            eventRevision: { select: { snapshot: true } },
          },
        });

        if (!application) {
          return unavailable;
        }

        if (application.status !== "PENDING") {
          return {
            code: "ALREADY_REVIEWED",
            message: "This application has already been reviewed.",
          };
        }

        const event = await tx.event.findUniqueOrThrow({
          where: { id: eventId },
          select: {
            publicId: true,
            publishedRevision: { select: { snapshot: true } },
          },
        });
        const snapshot = eventSnapshotSchema.safeParse(
          event.publishedRevision?.snapshot,
        );

        if (decision === "APPROVED") {
          if (!snapshot.success) {
            return {
              code: "PUBLICATION_UNAVAILABLE",
              message:
                "The published event is unavailable. Approval cannot proceed.",
            };
          }

          const capacity = snapshot.data.capacity;

          if (capacity !== null) {
            const approved = await tx.application.count({
              where: { eventId, status: "APPROVED" },
            });

            if (approved >= capacity) {
              return {
                code: "CAPACITY_REACHED",
                message:
                  "Published capacity reached. This application remains pending.",
              };
            }
          }
        }

        const reviewedAt = new Date();
        const updated = await tx.application.updateMany({
          where: { id: applicationId, eventId, status: "PENDING" },
          data: {
            status: decision,
            reviewedAt,
            // Review changes only status and reviewedAt, not submitted data.
            updatedAt: application.updatedAt,
          },
        });

        if (updated.count !== 1) {
          throw new Error(
            "Application transition did not affect exactly one row.",
          );
        }

        if (decision === "REJECTED") {
          const eventTitle = rejectionEventTitle(
            application.eventRevision.snapshot,
          );
          await enqueueApplicationEmail(tx, {
            applicationId,
            type: "APPLICATION_REJECTED",
            recipientEmail: application.email,
            payload: {
              schemaVersion: 1,
              applicantName: application.fullName,
              ...(eventTitle ? { eventTitle } : {}),
              ...(event.publicId ? { publicId: event.publicId } : {}),
            },
          });
        } else {
          // Approval already requires a valid current published snapshot.
          if (!snapshot.success || !event.publicId) {
            throw new Error("Published event email snapshot unavailable.");
          }

          await enqueueApplicationEmail(tx, {
            applicationId,
            type: "APPLICATION_APPROVED",
            recipientEmail: application.email,
            payload: {
              schemaVersion: 1,
              applicantName: application.fullName,
              event: emailEventSnapshot(snapshot.data, event.publicId),
            },
          });
        }

        await notifyApplicationChanged(tx, {
          eventId,
          userId: application.userId,
        });

        return { success: true };
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch {
    return {
      code: "FAILED",
      message: "We couldn’t review this application. Please try again.",
    };
  }
}
