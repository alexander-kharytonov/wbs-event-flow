import "server-only";
import { z } from "zod";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { prisma } from "@/lib/prisma";

const reviewInput = z.strictObject({
  eventId: z.string().min(1).max(200),
  applicationId: z.string().min(1).max(200),
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
          select: { status: true, updatedAt: true },
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

        if (decision === "APPROVED") {
          const event = await tx.event.findUniqueOrThrow({
            where: { id: eventId },
            select: { publishedRevision: { select: { snapshot: true } } },
          });
          const snapshot = eventSnapshotSchema.safeParse(
            event.publishedRevision?.snapshot,
          );

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
