import "server-only";
import { z } from "zod";
import { captureCommunicationActor } from "@/features/communications/server/eligibility";
import { enqueueTransactionalCommunication } from "@/features/communications/server/enqueue";
import { applicationsFrozen } from "@/features/events/event-lifecycle";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { issueTicket } from "@/features/tickets/server/issue-ticket";
import { emailEventSnapshot } from "@/lib/email-outbox/enqueue";
import {
  rejectionEventTitle,
  transactionalEmailSubjects,
} from "@/lib/email-outbox/payload";
import { recipientEmailLocale } from "@/lib/i18n/email-locale";
import type { Messages } from "@/lib/i18n/messages";
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
  message?: keyof Messages["events"];
};

export async function reviewEventApplication(
  actorUserId: string,
  input: unknown,
  decision: "APPROVED" | "REJECTED",
): Promise<ReviewResult> {
  const parsed = reviewInput.safeParse(input);
  const unavailable: ReviewResult = {
    code: "UNAVAILABLE",
    message: "applicationUnavailable",
  };

  if (!parsed.success) {
    return unavailable;
  }

  const { eventId, applicationId } = parsed.data;

  try {
    return await prisma.$transaction(
      async (tx) => {
        const locked = await lockEventForUpdate(tx, {
          id: eventId,
        });

        const access =
          locked &&
          (await authorizeEventActor(
            tx,
            eventId,
            actorUserId,
            "applications.review",
          ));

        if (
          !access ||
          !locked ||
          locked.archivedAt ||
          applicationsFrozen(locked, locked.decisionNow)
        ) {
          return unavailable;
        }

        const application = await tx.application.findFirst({
          where: { id: applicationId, eventId },
          select: {
            status: true,
            updatedAt: true,
            userId: true,
            user: { select: { uiLocale: true } },
            email: true,
            fullName: true,
            eventRevision: { select: { snapshot: true } },
          },
        });

        if (!application || application.userId === actorUserId) {
          return unavailable;
        }

        if (application.status !== "PENDING") {
          return {
            code: "ALREADY_REVIEWED",
            message: "applicationAlreadyReviewed",
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
              message: "applicationPublicationUnavailable",
            };
          }

          const capacity = snapshot.data.capacity;

          if (capacity !== null) {
            const occupied = await tx.attendee.count({
              where: { registration: { eventId }, revokedAt: null },
            });

            if (occupied >= capacity) {
              return {
                code: "CAPACITY_REACHED",
                message: "applicationCapacityReached",
              };
            }
          }
        }

        const reviewedAt = locked.decisionNow;
        const updated = await tx.application.updateMany({
          where: { id: applicationId, eventId, status: "PENDING" },
          data: {
            status: decision,
            reviewedAt,
            reviewedByUserId: actorUserId,
            // Review changes decision/provenance, never submitted data.
            updatedAt: application.updatedAt,
          },
        });

        if (updated.count !== 1) {
          throw new Error(
            "Application transition did not affect exactly one row.",
          );
        }

        const locale = recipientEmailLocale(
          application.user,
          application.eventRevision.snapshot,
        );
        const actor = await captureCommunicationActor(tx, access);

        if (decision === "REJECTED") {
          const eventTitle = rejectionEventTitle(
            application.eventRevision.snapshot,
          );
          await enqueueTransactionalCommunication(tx, {
            eventId,
            trigger: "APPLICATION_REJECTED",
            subject: transactionalEmailSubjects.APPLICATION_REJECTED,
            actor,
            contextSnapshot: {
              schemaVersion: 1,
              kind: "TRANSACTIONAL",
              trigger: "APPLICATION_REJECTED",
              ...(eventTitle ? { eventTitle } : {}),
            },
            idempotencyKey: `${applicationId}:PENDING_TO_REJECTED:APPLICATION_REJECTED`,
            recipients: [
              {
                recipientEmail: application.email,
                deduplicationKey: `${applicationId}:APPLICATION_REJECTED`,
                payload: {
                  locale,
                  schemaVersion: 1,
                  applicantName: application.fullName,
                  ...(eventTitle ? { eventTitle } : {}),
                  ...(event.publicId ? { publicId: event.publicId } : {}),
                },
              },
            ],
          });
        } else {
          const registration = await tx.registration.create({
            data: {
              eventId,
              sourceApplicationId: applicationId,
              userId: application.userId,
              attendeeName: application.fullName,
              attendeeEmail: application.email,
              createdAt: reviewedAt,
            },
          });

          const primary = await tx.attendee.create({
            data: {
              registrationId: registration.id,
              kind: "PRIMARY",
              userId: application.userId,
              name: application.fullName,
              email: application.email,
              createdAt: reviewedAt,
            },
          });
          const ticket = await issueTicket(tx, primary);

          // Approval already requires a valid current published snapshot.
          if (!snapshot.success || !event.publicId) {
            throw new Error("Published event email snapshot unavailable.");
          }

          await enqueueTransactionalCommunication(tx, {
            eventId,
            trigger: "APPLICATION_APPROVED",
            subject: transactionalEmailSubjects.APPLICATION_APPROVED,
            actor,
            contextSnapshot: {
              schemaVersion: 1,
              kind: "TRANSACTIONAL",
              trigger: "APPLICATION_APPROVED",
              eventTitle: snapshot.data.title,
            },
            idempotencyKey: `${applicationId}:PENDING_TO_APPROVED:APPLICATION_APPROVED`,
            recipients: [
              {
                recipientEmail: application.email,
                deduplicationKey: `${applicationId}:APPLICATION_APPROVED`,
                payload: {
                  locale,
                  schemaVersion: 2,
                  ticketId: ticket.id,
                  applicantName: application.fullName,
                  event: emailEventSnapshot(snapshot.data, event.publicId),
                },
              },
            ],
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
      message: "applicationReviewFailed",
    };
  }
}
