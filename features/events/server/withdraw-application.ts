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

        const admission = await tx.registration.findUnique({
          where: { sourceApplicationId: applicationId },
          include: {
            attendees: {
              where: { kind: "PRIMARY" },
              include: { ticket: true },
            },
          },
        });

        if (application.status === "PENDING" && admission) {
          throw new Error("Pending application cannot have admission history.");
        }

        if (application.status === "APPROVED") {
          const primary = admission?.attendees[0];
          const ticket = primary?.ticket;

          if (
            !admission ||
            admission.eventId !== eventId ||
            admission.userId !== userId ||
            admission.revokedAt ||
            admission.attendees.length !== 1 ||
            !primary ||
            primary.revokedAt ||
            primary.userId !== admission.userId ||
            primary.name !== admission.attendeeName ||
            primary.email !== admission.attendeeEmail ||
            +primary.createdAt !== +admission.createdAt ||
            !ticket ||
            ticket.revokedAt ||
            +ticket.issuedAt !== +primary.createdAt
          ) {
            throw new Error(
              "Approved withdrawal admission correspondence failed.",
            );
          }
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

          if (!admission) {
            throw new Error("Registration is missing.");
          }

          const activeAttendees = await tx.attendee.findMany({
            where: { registrationId: admission.id, revokedAt: null },
            select: { id: true, ticket: { select: { revokedAt: true } } },
          });

          if (
            activeAttendees.some(
              (attendee) => !attendee.ticket || attendee.ticket.revokedAt,
            )
          ) {
            throw new Error("Active party Ticket correspondence failed.");
          }

          const ids = activeAttendees.map(({ id }) => id);
          const revokedAttendees = await tx.attendee.updateMany({
            where: { id: { in: ids }, revokedAt: null },
            data: { revokedAt: now },
          });
          const revokedTickets = await tx.ticket.updateMany({
            where: { attendeeId: { in: ids }, revokedAt: null },
            data: { revokedAt: now },
          });

          if (
            revokedAttendees.count !== ids.length ||
            revokedTickets.count !== ids.length
          ) {
            throw new Error("Whole-party revocation correspondence failed.");
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
