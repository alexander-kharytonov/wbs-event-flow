import "server-only";
import { z } from "zod";
import { historicalAnswers } from "@/features/events/historical-answers";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import {
  presentTicket,
  ticketDisplaySelect,
} from "@/features/tickets/server/ticket-display";
import { prisma } from "@/lib/prisma";

// Call only with the user ID returned by the authoritative verified session.
export async function getMyRegistration(userId: string, eventId: string) {
  if (!z.uuid().safeParse(eventId).success) {
    return null;
  }

  const applications = await prisma.$transaction(
    async (tx) => {
      const attempts = await tx.application.findMany({
        where: { userId, eventId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          status: true,
          fullName: true,
          email: true,
          createdAt: true,
          reviewedAt: true,
          withdrawnAt: true,
          eventRevisionId: true,
          registrations: {
            where: { userId },
            select: {
              ticket: { select: ticketDisplaySelect },
              attendance: { select: { checkedInAt: true } },
              createdAt: true,
              revokedAt: true,
              attendeeName: true,
              attendeeEmail: true,
            },
          },
        },
      });

      if (attempts.length === 0) {
        return [];
      }

      // Keep relation reads sequential on the transaction's pg connection.
      const revisions = await tx.eventRevision.findMany({
        where: {
          eventId,
          id: { in: attempts.map((attempt) => attempt.eventRevisionId) },
        },
        select: { id: true, snapshot: true },
      });
      const answers = await tx.applicationAnswer.findMany({
        where: { applicationId: { in: attempts.map((attempt) => attempt.id) } },
        select: {
          applicationId: true,
          fieldId: true,
          textValue: true,
          booleanValue: true,
          selectedOptions: { select: { optionId: true } },
        },
      });
      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          endsAt: true,
          cancelledAt: true,
          cancellationReason: true,
          publicId: true,
          publishedRevision: { select: { snapshot: true } },
        },
      });

      return attempts.map((attempt) => ({
        ...attempt,
        snapshot: revisions.find(
          (revision) => revision.id === attempt.eventRevisionId,
        )?.snapshot,
        answers: answers.filter(
          (answer) => answer.applicationId === attempt.id,
        ),
        event,
      }));
    },
    { isolationLevel: "RepeatableRead" },
  );
  const currentApplication =
    applications.find(({ status }) => status !== "WITHDRAWN") ??
    applications[0];

  if (!currentApplication) {
    return null;
  }

  const publication = eventSnapshotSchema.safeParse(
    currentApplication.event.publishedRevision?.snapshot,
  );
  const publicId = currentApplication.event.publicId;
  const currentPublication =
    publication.success && z.uuid().safeParse(publicId).success
      ? publication.data
      : null;
  const completed = currentApplication.event.endsAt.getTime() <= Date.now();
  const publishedContext = currentPublication
    ? {
        title: currentPublication.title,
        startsAt: currentPublication.startsAt,
        endsAt: currentPublication.endsAt,
        timezone: currentPublication.timezone,
      }
    : null;
  const attempts = await Promise.all(
    applications.map(async (application) => {
      const submitted = eventSnapshotSchema.safeParse(application.snapshot);
      const context = submitted.success
        ? {
            title: submitted.data.title,
            startsAt: submitted.data.startsAt,
            endsAt: submitted.data.endsAt,
            timezone: submitted.data.timezone,
          }
        : null;
      const admission = application.registrations[0];
      const ticket = admission?.ticket
        ? await presentTicket(
            admission.ticket,
            admission,
            application.id === currentApplication.id
              ? (publishedContext ?? context)
              : context,
            currentApplication.event.cancelledAt,
            completed,
          )
        : null;

      return {
        id: application.id,
        status: application.status,
        admission: admission
          ? {
              createdAt: admission.createdAt,
              revokedAt: admission.revokedAt,
              ticket,
            }
          : null,
        fullName: application.fullName,
        email: application.email,
        submittedAt: application.createdAt,
        reviewedAt: application.reviewedAt,
        withdrawnAt: application.withdrawnAt,
        context,
        answers: historicalAnswers(application.snapshot, application.answers),
      };
    }),
  );
  const current = attempts.find(({ id }) => id === currentApplication.id);

  if (!current) {
    return null;
  }

  return {
    completed,
    cancelledAt: currentApplication.event.cancelledAt,
    cancellationReason: currentApplication.event.cancellationReason,
    context: publishedContext ?? current.context,
    historicalContext: currentPublication === null,
    publicId: currentPublication ? publicId : null,
    current,
    previous: attempts.filter(({ id }) => id !== current.id),
  };
}
