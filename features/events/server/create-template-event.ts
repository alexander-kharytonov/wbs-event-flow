import "server-only";
import {
  type TemplateIssue,
  validateTemplateCreate,
} from "@/features/events/import/template-input";
import { createEventCore } from "@/features/events/server/create-event-core";
import { createEventWithCover } from "@/features/events/server/create-event-with-cover";
import { MediaError } from "@/features/events/server/media-image";
import {
  reserveStaffResolution,
  resolveStaff,
} from "@/features/events/server/staff-resolution";
import { normalizeStaff } from "@/features/events/staff-input";

export type TemplateCreateResult =
  | {
      success: true;
      eventId: string;
      addedCount: number;
      skippedEmails: string[];
      duplicateWarnings: string[];
    }
  | { success: false; issues: TemplateIssue[]; creationUncertain?: boolean };

// Actor and organizer are supplied exclusively by the authenticated server adapter.
// Accepts object input without a JSON round-trip for future projector consumers.
export async function createTemplateEvent(
  actorUserId: string,
  organizerId: string,
  input: unknown,
  creation: unknown,
): Promise<TemplateCreateResult> {
  const parsed = validateTemplateCreate(input);

  if (!parsed.success) {
    return parsed;
  }

  const event = parsed.template.event;
  const staff = normalizeStaff(event.staff);

  try {
    const result = await createEventWithCover(
      organizerId,
      creation,
      { kind: "template", event },
      async (tx) => {
        if (
          !reserveStaffResolution(
            actorUserId,
            staff.members.map((member) => member.email),
          )
        ) {
          throw new MediaError(429, "staffBudget");
        }
        const { resolved, skippedEmails } = await resolveStaff(
          tx,
          actorUserId,
          staff.members,
        );
        const eventId = await createEventCore(
          tx,
          organizerId,
          {
            location: event.location,
            schedule: event.schedule,
            publicOrganizer: event.publicOrganizer,
            title: event.title,
            language: event.language,
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
        );

        return {
          eventId,
          addedCount: resolved.length,
          skippedEmails,
          duplicateWarnings: staff.duplicates,
        };
      },
    );

    return { success: true, ...result };
  } catch (error) {
    return {
      success: false,
      creationUncertain: !(error instanceof MediaError),
      issues: [
        {
          code:
            error instanceof MediaError && error.code === "staffBudget"
              ? "staff_budget"
              : "create_failed",
          path:
            error instanceof MediaError && error.code === "staffBudget"
              ? "event.staff"
              : "template",
          message:
            error instanceof MediaError
              ? error.code
              : "templateCreationUnconfirmed",
        },
      ],
    };
  }
}
