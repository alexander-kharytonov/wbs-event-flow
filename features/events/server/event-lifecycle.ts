import "server-only";
import { z } from "zod";
import { captureCommunicationActor } from "@/features/communications/server/eligibility";
import { enqueueTransactionalCommunication } from "@/features/communications/server/enqueue";
import { eventLifecycle } from "@/features/events/event-lifecycle";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { lockEventForUpdate } from "@/features/events/server/lock-event-for-update";
import { Prisma } from "@/generated/prisma/client";
import {
  eventCancelledPayload,
  transactionalEmailSubjects,
} from "@/lib/email-outbox/payload";
import { prisma } from "@/lib/prisma";
import {
  applicationNotificationChannel,
  notifyEventChanged,
} from "@/lib/realtime/application-notifications";

const commandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    eventId: z.uuid(),
    action: z.literal("cancel"),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.strictObject({
    eventId: z.uuid(),
    action: z.enum(["unpublish", "archive", "restore", "delete"]),
  }),
]);

export type LifecycleResult = {
  success?: true;
  deleted?: true;
  message?: string;
};

export async function changeOwnedEventLifecycle(
  organizerId: string,
  input: unknown,
): Promise<LifecycleResult> {
  const parsed = commandSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: "Check the action and cancellation reason (1–2000 characters).",
    };
  }

  const command = parsed.data;

  try {
    return await prisma.$transaction(
      async (tx): Promise<LifecycleResult> => {
        const event = await lockEventForUpdate(tx, {
          id: command.eventId,
          organizerId,
        });

        if (!event) {
          return { message: "This event is unavailable." };
        }

        const lifecycle = eventLifecycle(event, event.decisionNow);

        if (command.action === "restore") {
          if (!event.archivedAt) {
            return { success: true };
          }

          await tx.event.update({
            where: { id: event.id },
            data: { archivedAt: null, updatedAt: event.updatedAt },
          });

          await notifyEventChanged(tx, event.id);

          return { success: true };
        }

        if (event.archivedAt) {
          return {
            message:
              "Restore this event from archive before changing its workspace.",
          };
        }

        if (command.action === "archive") {
          if (lifecycle !== "Completed" && lifecycle !== "Cancelled") {
            return {
              message: "Only completed or cancelled events can be archived.",
            };
          }

          await tx.event.update({
            where: { id: event.id },
            data: { archivedAt: event.decisionNow, updatedAt: event.updatedAt },
          });

          await notifyEventChanged(tx, event.id);

          return { success: true };
        }

        if (event.cancelledAt) {
          return { message: "Cancellation is final. This event is read-only." };
        }

        if (command.action === "unpublish") {
          if (!event.publishedRevisionId) {
            return { message: "This event is already unpublished." };
          }

          await tx.event.update({
            where: { id: event.id },
            data: { publishedRevisionId: null, updatedAt: event.updatedAt },
          });

          await notifyEventChanged(tx, event.id);

          return { success: true };
        }

        const latest = await tx.eventRevision.findFirst({
          where: { eventId: event.id },
          orderBy: { number: "desc" },
          select: { snapshot: true },
        });

        if (command.action === "delete") {
          const application = await tx.application.findFirst({
            where: { eventId: event.id },
            select: { id: true },
          });

          const registration = await tx.registration.findFirst({
            where: { eventId: event.id },
            select: { id: true },
          });

          if (
            latest ||
            application ||
            registration ||
            event.publicId ||
            event.publishedAt
          ) {
            return {
              message:
                "Only a never-published draft without applications can be deleted.",
            };
          }

          await tx.event.delete({ where: { id: event.id } });

          return { success: true, deleted: true };
        }

        if (
          command.action !== "cancel" ||
          !latest ||
          lifecycle === "Completed"
        ) {
          return {
            message:
              "Only previously published upcoming or ongoing events can be cancelled.",
          };
        }

        // Use published history for attendee email context, never unpublished edits.
        const current = event.publishedRevisionId
          ? await tx.eventRevision.findUnique({
              where: { id: event.publishedRevisionId },
              select: { snapshot: true },
            })
          : null;
        const currentSnapshot = eventSnapshotSchema.safeParse(
          current?.snapshot,
        );
        const snapshot = currentSnapshot.success
          ? currentSnapshot.data
          : eventSnapshotSchema.parse(latest.snapshot);
        const affected = await tx.application.findMany({
          where: { eventId: event.id, status: "PENDING" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, email: true, fullName: true, userId: true },
        });
        const admissions = await tx.registration.findMany({
          where: { eventId: event.id, revokedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            attendeeEmail: true,
            attendeeName: true,
            userId: true,
          },
        });
        affected.push(
          ...admissions.map((admission) => ({
            id: admission.id,
            email: admission.attendeeEmail,
            fullName: admission.attendeeName,
            userId: admission.userId,
          })),
        );
        const recipients = new Map<string, (typeof affected)[number]>();

        for (const application of affected) {
          const email = application.email.trim().toLowerCase();

          if (!recipients.has(email)) {
            recipients.set(email, application);
          }
        }

        await tx.event.update({
          where: { id: event.id },
          data: {
            cancelledAt: event.decisionNow,
            cancellationReason: command.reason,
            updatedAt: event.updatedAt,
          },
        });

        // The existing verified organizer boundary and owner-scoped Event lock
        // establish this actor; never infer ownership from recipient identity.
        const owner = await tx.organizerProfile.findUniqueOrThrow({
          where: { id: event.organizerId },
          select: { userId: true },
        });
        const actor = await captureCommunicationActor(tx, {
          userId: owner.userId,
          role: "OWNER",
        });
        await enqueueTransactionalCommunication(tx, {
          eventId: event.id,
          trigger: "EVENT_CANCELLED",
          subject: transactionalEmailSubjects.EVENT_CANCELLED,
          actor,
          contextSnapshot: {
            schemaVersion: 1,
            kind: "TRANSACTIONAL",
            trigger: "EVENT_CANCELLED",
            eventTitle: snapshot.title,
          },
          // Cancellation is irreversible and can happen only once per Event.
          idempotencyKey: `${event.id}:EVENT_CANCELLED`,
          // An empty audience records the cancellation with zero delivery intents.
          recipients: [...recipients].map(([email, application]) => ({
            deduplicationKey: `${event.id}:EVENT_CANCELLED:${email}`,
            recipientEmail: email,
            payload: eventCancelledPayload.parse({
              schemaVersion: 1,
              applicantName: application.fullName,
              event: {
                title: snapshot.title,
                startsAt: snapshot.startsAt,
                endsAt: snapshot.endsAt,
                timezone: snapshot.timezone,
              },
              cancellationReason: command.reason,
              ...(currentSnapshot.success && event.publicId
                ? { publicId: event.publicId }
                : {}),
            }),
          })),
        });

        const users = [
          ...new Set(
            affected.flatMap(({ userId }) => (userId ? [userId] : [])),
          ),
        ];
        // One SQL round trip, existing per-user routing payloads and browser contract.
        const payloads = users.map((userId) =>
          JSON.stringify({
            type: "applications.changed",
            eventId: event.id,
            userId,
          }),
        );
        payloads.push(
          JSON.stringify({
            type: "applications.changed",
            eventId: event.id,
            userId: null,
          }),
        );
        await tx.$executeRaw`SELECT pg_notify(${applicationNotificationChannel}::text, payload) FROM unnest(ARRAY[${Prisma.join(payloads)}]::text[]) AS notices(payload)`;

        return { success: true };
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch {
    return { message: "Could not change this event. Reload and try again." };
  }
}
