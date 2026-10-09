import "server-only";
import { authorizeEventActor } from "@/features/events/server/event-access";
import {
  checkTemplateCounts,
  EventTemplateError,
} from "@/features/exports/event-template";
import { projectEventTemplate } from "@/features/exports/server/project-event-template";
import { prisma } from "@/lib/prisma";

// Only a fresh, verified session-derived userId is accepted by the caller.
export async function readEventTemplate(userId: string, eventId: string) {
  return prisma.$transaction(
    async (tx) => {
      const access = await authorizeEventActor(
        tx,
        eventId,
        userId,
        "event.edit",
      );

      if (!access) {
        return null;
      }

      // Count before loading question text, option labels or staff emails.
      const fieldCount = await tx.registrationField.count({
        where: { form: { eventId } },
      });
      const staffCount = await tx.eventStaff.count({ where: { eventId } });
      checkTemplateCounts(fieldCount, [], staffCount);
      const optionCounts = await tx.registrationField.findMany({
        where: { form: { eventId } },
        select: { _count: { select: { options: true } } },
      });
      checkTemplateCounts(
        fieldCount,
        optionCounts.map((field) => field._count.options),
        staffCount,
      );
      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          title: true,
          description: true,
          descriptionFormat: true,
          coverAssetId: true,
          coverAlt: true,
          location: true,
          schedule: true,
          publicOrganizer: true,
          startsAt: true,
          endsAt: true,
          timezone: true,
          visibility: true,
          accountRequirement: true,
          capacity: true,
          maxGuestsPerRegistration: true,
          registrationOpensAt: true,
          registrationClosesAt: true,
          badgeLayout: true,
          registrationForm: {
            select: {
              fields: {
                orderBy: { position: "asc" },
                select: {
                  id: true,
                  type: true,
                  label: true,
                  description: true,
                  required: true,
                  options: {
                    orderBy: { position: "asc" },
                    select: { label: true },
                  },
                },
              },
            },
          },
          staff: {
            orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
            select: { role: true, user: { select: { email: true } } },
          },
        },
      });

      if (!event.registrationForm) {
        throw new EventTemplateError("configuration");
      }

      if (
        event.descriptionFormat !== "PLAIN_TEXT" ||
        event.coverAssetId !== null ||
        event.coverAlt !== null ||
        event.location !== null ||
        event.publicOrganizer !== null ||
        !Array.isArray(event.schedule) ||
        event.schedule.length > 0
      ) {
        throw new EventTemplateError("richContent");
      }

      return projectEventTemplate({
        ...event,
        registrationForm: event.registrationForm,
        staff: event.staff.map((member) => ({
          email: member.user.email,
          role: member.role,
        })),
      });
    },
    { isolationLevel: "RepeatableRead", timeout: 30_000 },
  );
}
