import "server-only";
import {
  type BadgeField,
  readBadgeLayout,
} from "@/features/badges/badge-layout";
import {
  checkTemplateCounts,
  EventTemplateError,
  type EventTemplateV2,
  eventTemplateV2Schema,
} from "@/features/exports/event-template";

type PortableEvent = EventTemplateV2["event"];

export type EventTemplateSource = Omit<
  PortableEvent,
  | "startsAt"
  | "endsAt"
  | "registrationOpensAt"
  | "registrationClosesAt"
  | "registrationForm"
  | "badgeLayout"
> & {
  startsAt: Date;
  endsAt: Date;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  registrationForm: {
    fields: (Omit<
      PortableEvent["registrationForm"]["fields"][number],
      "key"
    > & { id: string })[];
  };
  badgeLayout: unknown;
};

// Input arrays are already in current workspace order; no HTTP or database dependency.
export function projectEventTemplate(
  source: EventTemplateSource,
): EventTemplateV2 {
  const fields = source.registrationForm.fields;
  checkTemplateCounts(
    fields.length,
    fields.map((field) => field.options.length),
    source.staff.length,
  );
  const registrationForm = {
    fields: fields.map((field, index) => ({
      key: `field_${index + 1}`,
      type: field.type,
      label: field.label,
      description: field.description,
      required: field.required,
      options: field.options.map((option) => ({ label: option.label })),
    })),
  };
  let badgeLayout: PortableEvent["badgeLayout"] = null;

  if (source.badgeLayout !== null) {
    const parsed = readBadgeLayout(source.badgeLayout);

    if (!parsed.success) {
      throw new EventTemplateError("layout");
    }

    const mapBinding = (binding: BadgeField | null) => {
      if (binding === null) {
        return null;
      }

      const index = fields.findIndex(
        (field) =>
          field.id === binding.fieldId &&
          field.type === binding.type &&
          field.label === binding.label,
      );

      if (index < 0) {
        throw new EventTemplateError("binding");
      }

      return {
        fieldKey: `field_${index + 1}`,
        type: binding.type,
        label: binding.label,
      };
    };
    const layout = parsed.data;
    badgeLayout = {
      formatVersion: layout.formatVersion,
      size: layout.size,
      orientation: layout.orientation,
      showEventName: layout.showEventName,
      showAttendeeType: layout.showAttendeeType,
      showQr: layout.showQr,
      showTicketNumber: layout.showTicketNumber,
      secondaryField: mapBinding(layout.secondaryField),
      tertiaryField: mapBinding(layout.tertiaryField),
      nameSize: layout.nameSize,
      alignment: layout.alignment,
      paddingMm: layout.paddingMm,
    };
  }

  const result = eventTemplateV2Schema.safeParse({
    format: "event-flow-template",
    version: 2,
    event: {
      descriptionFormat: source.descriptionFormat,
      location: source.location,
      schedule: source.schedule,
      publicOrganizer: source.publicOrganizer,
      cover: source.cover,
      title: source.title,
      description: source.description,
      startsAt: source.startsAt.toISOString(),
      endsAt: source.endsAt.toISOString(),
      timezone: source.timezone,
      visibility: source.visibility,
      accountRequirement: source.accountRequirement,
      capacity: source.capacity,
      maxGuestsPerRegistration: source.maxGuestsPerRegistration,
      registrationOpensAt: source.registrationOpensAt?.toISOString() ?? null,
      registrationClosesAt: source.registrationClosesAt?.toISOString() ?? null,
      registrationForm,
      staff: source.staff.map((member) => ({
        email: member.email.trim().toLowerCase(),
        role: member.role,
      })),
      badgeLayout,
    },
  });

  if (!result.success) {
    throw new EventTemplateError("configuration");
  }

  return result.data;
}
