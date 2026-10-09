import "server-only";
import {
  type TemplateIssue,
  validateTemplateCreate,
} from "@/features/events/import/template-input";
import { createEventCore } from "@/features/events/server/create-event-core";
import {
  reserveStaffResolution,
  resolveStaff,
  staffBudgetMessage,
} from "@/features/events/server/staff-resolution";
import { normalizeStaff } from "@/features/events/staff-input";
import { prisma } from "@/lib/prisma";

export type TemplateCreateResult =
  | {
      success: true;
      eventId: string;
      addedCount: number;
      skippedEmails: string[];
      duplicateWarnings: string[];
    }
  | { success: false; issues: TemplateIssue[] };

// Actor and organizer are supplied exclusively by the authenticated server adapter.
// Accepts object input without a JSON round-trip for future projector consumers.
export async function createTemplateEvent(
  actorUserId: string,
  organizerId: string,
  input: unknown,
): Promise<TemplateCreateResult> {
  const parsed = validateTemplateCreate(input);

  if (!parsed.success) {
    return parsed;
  }

  const event = parsed.template.event;
  const staff = normalizeStaff(event.staff);

  if (
    !reserveStaffResolution(
      actorUserId,
      staff.members.map((member) => member.email),
    )
  ) {
    return {
      success: false,
      issues: [
        {
          code: "staff_budget",
          path: "event.staff",
          message: staffBudgetMessage,
        },
      ],
    };
  }

  try {
    const { resolved, skippedEmails } = await resolveStaff(
      prisma,
      actorUserId,
      staff.members,
    );
    const eventId = await prisma.$transaction(
      (tx) =>
        createEventCore(
          tx,
          organizerId,
          {
            descriptionFormat: event.descriptionFormat,
            location: event.location,
            schedule: event.schedule,
            publicOrganizer: event.publicOrganizer,
            title: event.title,
            description: event.description,
            startsAt: new Date(event.startsAt),
            endsAt: new Date(event.endsAt),
            timezone: event.timezone,
            visibility: event.visibility,
            accountRequirement: event.accountRequirement,
            capacity: event.capacity,
            maxGuestsPerRegistration: event.maxGuestsPerRegistration,
            registrationOpensAt: event.registrationOpensAt
              ? new Date(event.registrationOpensAt)
              : null,
            registrationClosesAt: event.registrationClosesAt
              ? new Date(event.registrationClosesAt)
              : null,
          },
          event.registrationForm.fields,
          event.badgeLayout,
          resolved,
        ),
      { timeout: 15000 },
    );

    return {
      success: true,
      eventId,
      addedCount: resolved.length,
      skippedEmails,
      duplicateWarnings: staff.duplicates,
    };
  } catch {
    return {
      success: false,
      issues: [
        {
          code: "create_failed",
          path: "template",
          message: "We couldn’t create the event. Please try again.",
        },
      ],
    };
  }
}
