import "server-only";
import { prisma } from "@/lib/prisma";

export async function getOwnedApplications(
  organizerId: string,
  eventId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, organizerId },
        select: {
          title: true,
          timezone: true,
          publishedRevisionId: true,
          contentVersion: true,
          publicId: true,
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
        },
      });

      return {
        title: event.title,
        contentVersion: event.contentVersion,
        publicId: event.publicId,
        timezone: event.timezone,
        publishedRevision,
        applications,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function getOwnedApplication(
  organizerId: string,
  eventId: string,
  applicationId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const application = await tx.application.findFirst({
        where: { id: applicationId, eventId, event: { organizerId } },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
          eventRevisionId: true,
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
          title: true,
          _count: { select: { applications: true } },
          timezone: true,
          publishedRevisionId: true,
          contentVersion: true,
          publicId: true,
        },
      });
      const publishedRevision = event.publishedRevisionId
        ? await tx.eventRevision.findUnique({
            where: { id: event.publishedRevisionId },
            select: { snapshot: true, contentVersion: true, number: true },
          })
        : null;
      const approved = await tx.application.count({
        where: { eventId, status: "APPROVED" },
      });

      return {
        ...application,
        eventRevision,
        answers,
        event: {
          applicationCount: event._count.applications,
          title: event.title,
          contentVersion: event.contentVersion,
          publicId: event.publicId,
          timezone: event.timezone,
          publishedRevision,
          _count: { applications: approved },
        },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
