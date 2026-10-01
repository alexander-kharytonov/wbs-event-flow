import "server-only";
import { z } from "zod";
import { authorizeEventActor } from "@/features/events/server/event-access";
import { prisma } from "@/lib/prisma";

export async function getEventApplications(userId: string, eventId: string) {
  if (!z.uuid().safeParse(eventId).success) {
    return null;
  }

  return prisma.$transaction(
    async (tx) => {
      const access = await authorizeEventActor(
        tx,
        eventId,
        userId,
        "applications.read",
      );

      if (!access) {
        return null;
      }

      const event = await tx.event.findFirst({
        where: { id: eventId },
        select: {
          startsAt: true,
          endsAt: true,
          cancelledAt: true,
          cancellationReason: true,
          archivedAt: true,
          title: true,
          _count: { select: { revisions: true } },
          timezone: true,
          publishedRevisionId: true,
          contentVersion: true,
          publicId: true,
          publishedAt: true,
        },
      });

      if (!event) {
        return null;
      }

      // Read relations sequentially: pg does not support concurrent queries
      // on the single connection used by this repeatable-read transaction.
      const publishedRevision = event.publishedRevisionId
        ? await tx.eventRevision.findUnique({
            where: { id: event.publishedRevisionId },
            select: { snapshot: true, contentVersion: true, number: true },
          })
        : null;
      const applications = await tx.application.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          createdAt: true,
          registrations: { select: { createdAt: true, revokedAt: true } },
        },
      });

      const occupied = await tx.attendee.count({
        where: { registration: { eventId }, revokedAt: null },
      });

      return {
        occupied,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        cancelledAt: event.cancelledAt,
        cancellationReason: event.cancellationReason,
        archivedAt: event.archivedAt,
        title: event.title,
        contentVersion: event.contentVersion,
        publicId: event.publicId,
        publishedAt: event.publishedAt,
        _count: event._count,
        timezone: event.timezone,
        publishedRevision,
        applications,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function getEventApplication(
  userId: string,
  eventId: string,
  applicationId: string,
) {
  if (
    !z.uuid().safeParse(eventId).success ||
    !z.uuid().safeParse(applicationId).success
  ) {
    return null;
  }

  return prisma.$transaction(
    async (tx) => {
      const access = await authorizeEventActor(
        tx,
        eventId,
        userId,
        "applications.read",
      );

      if (!access) {
        return null;
      }

      const application = await tx.application.findFirst({
        where: { id: applicationId, eventId },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
          userId: true,
          reviewedByUser: { select: { name: true } },
          withdrawnAt: true,
          eventRevisionId: true,
          registrations: { select: { createdAt: true, revokedAt: true } },
        },
      });

      if (!application) {
        return null;
      }

      // Keep each relation read awaited on this transaction's connection.
      const eventRevision = await tx.eventRevision.findUniqueOrThrow({
        where: { id: application.eventRevisionId },
        select: { snapshot: true },
      });
      const answers = await tx.applicationAnswer.findMany({
        where: { applicationId },
        select: {
          fieldId: true,
          textValue: true,
          booleanValue: true,
          selectedOptions: { select: { optionId: true } },
        },
      });
      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          startsAt: true,
          endsAt: true,
          cancelledAt: true,
          cancellationReason: true,
          archivedAt: true,
          title: true,
          _count: { select: { applications: true, revisions: true } },
          timezone: true,
          publishedRevisionId: true,
          contentVersion: true,
          publicId: true,
          publishedAt: true,
        },
      });
      const publishedRevision = event.publishedRevisionId
        ? await tx.eventRevision.findUnique({
            where: { id: event.publishedRevisionId },
            select: { snapshot: true, contentVersion: true, number: true },
          })
        : null;
      const occupied = await tx.attendee.count({
        where: { registration: { eventId }, revokedAt: null },
      });

      return {
        ...application,
        eventRevision,
        answers,
        event: {
          applicationCount: event._count.applications,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          cancelledAt: event.cancelledAt,
          cancellationReason: event.cancellationReason,
          archivedAt: event.archivedAt,
          title: event.title,
          contentVersion: event.contentVersion,
          publicId: event.publicId,
          publishedAt: event.publishedAt,
          _count: event._count,
          timezone: event.timezone,
          publishedRevision,
          occupied,
        },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
