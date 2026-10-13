import { Temporal } from "@js-temporal/polyfill";
import type { z } from "zod";
import {
  scheduleFormValues,
  validateEventDateRelationships,
} from "@/features/events/event-input-schema";
import {
  isChoice,
  registrationFieldData,
} from "@/features/events/schemas/registration-form";
import { normalizeStaff } from "@/features/events/staff-input";
import {
  type EventTemplate,
  eventTemplateSchema,
  TEMPLATE_LIMITS,
} from "@/features/exports/event-template";

export type TemplateIssue = { code: string; path: string; message: string };

export type TemplateResult =
  | {
      success: true;
      template: EventTemplate;
      duplicateWarnings: string[];
    }
  | { success: false; issues: TemplateIssue[] };

export type TemplateEvent = EventTemplate["event"];

export type TemplateField = TemplateEvent["registrationForm"]["fields"][number];

const knownSegments = new Set([
  "location",
  "schedule",
  "publicOrganizer",
  "cover",
  "status",
  "venueName",
  "address",
  "onlineLabel",
  "onlineUrl",
  "displayName",
  "websiteUrl",
  "format",
  "event",
  "title",
  "language",
  "description",
  "startsAt",
  "endsAt",
  "timezone",
  "visibility",
  "accountRequirement",
  "capacity",
  "maxGuestsPerRegistration",
  "registrationOpensAt",
  "registrationClosesAt",
  "registrationForm",
  "fields",
  "key",
  "type",
  "label",
  "required",
  "options",
  "staff",
  "email",
  "role",
  "badgeLayout",
  "formatVersion",
  "size",
  "orientation",
  "showEventName",
  "showAttendeeType",
  "showQr",
  "showTicketNumber",
  "secondaryField",
  "tertiaryField",
  "fieldKey",
  "nameSize",
  "alignment",
  "paddingMm",
]);

export function safeTemplateIssues(error: z.ZodError): TemplateIssue[] {
  return error.issues.slice(0, 30).map((issue) => {
    let path = "";

    for (const segment of issue.path) {
      if (
        typeof segment === "number" &&
        Number.isInteger(segment) &&
        segment >= 0 &&
        segment <= 1000
      ) {
        path += `[${segment}]`;
      } else if (typeof segment === "string" && knownSegments.has(segment)) {
        path += `${path ? "." : ""}${segment}`;
      } else {
        break;
      }
    }

    return {
      code:
        issue.code === "unrecognized_keys" ? "unknown_fields" : "invalid_value",
      path: path || "template",
      message:
        issue.code === "unrecognized_keys"
          ? "templateUnknownFields"
          : "templateInvalidValue",
    };
  });
}

export function templateFailure(
  code: string,
  path: string,
  message: string,
): TemplateResult {
  return { success: false, issues: [{ code, path, message }] };
}

export function portableBindingIssues(
  event: Pick<TemplateEvent, "registrationForm" | "badgeLayout">,
): TemplateIssue[] {
  const issues: TemplateIssue[] = [];

  for (const slot of ["secondaryField", "tertiaryField"] as const) {
    const binding = event.badgeLayout?.[slot];

    if (
      binding &&
      !event.registrationForm.fields.some(
        (field) =>
          field.key === binding.fieldKey &&
          field.type === binding.type &&
          field.label === binding.label,
      )
    ) {
      issues.push({
        code: "badge_binding",
        path: `event.badgeLayout.${slot}`,
        message: "templateBindingChanged",
      });
    }
  }

  return issues;
}

// Transport independent: Duplicate can later call this with projector output.

export function validateTemplateCreate(input: unknown): TemplateResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return templateFailure("format", "template", "templateObject");
  }

  if (!("format" in input) || input.format !== "event-flow-template") {
    return templateFailure("format", "format", "templateFormat");
  }

  const parsed = eventTemplateSchema.safeParse(input);

  if (!parsed.success) {
    // Binding/count refinements have root paths. Supply useful known paths
    // without echoing input or altering the accepted export contract.
    const issues = safeTemplateIssues(parsed.error);

    for (const [index, issue] of parsed.error.issues.slice(0, 30).entries()) {
      if (issue.message === "Invalid badge field binding.") {
        issues[index] = {
          code: "badge_binding",
          path: "event.badgeLayout",
          message: "templateBindingInvalid",
        };
      } else if (issue.message === "Too many options.") {
        issues[index] = {
          code: "limit",
          path: "event.registrationForm.fields",
          message: "templateOptionsLimit",
        };
      }
    }

    return { success: false, issues };
  }

  const event = parsed.data.event;
  event.description = event.description || null;
  const issues: TemplateIssue[] = [];
  const dates = {
    startsAt: new Date(event.startsAt),
    endsAt: new Date(event.endsAt),
    registrationOpensAt: event.registrationOpensAt
      ? new Date(event.registrationOpensAt)
      : null,
    registrationClosesAt: event.registrationClosesAt
      ? new Date(event.registrationClosesAt)
      : null,
  };

  validateEventDateRelationships(dates, {
    addIssue(issue) {
      issues.push({
        code: "date_relationship",
        path: `event.${issue.path?.[0] ?? "endsAt"}`,
        message: String(issue.message),
      });
    },
  });

  // Apply the same normalization as the manual field writer, including options.
  event.registrationForm.fields = event.registrationForm.fields.map((field) => {
    const normalized = registrationFieldData({
      type: field.type,
      label: field.label,
      description: field.description ?? "",
      required: field.required,
      ...(isChoice(field.type) ? { options: field.options } : {}),
    });

    return {
      key: field.key,
      ...normalized,
      options: normalized.options.map(({ label }) => ({ label })),
    };
  });
  issues.push(...portableBindingIssues(event));
  const staff = normalizeStaff(event.staff);

  for (const index of staff.conflicts) {
    issues.push({
      code: "staff_role_conflict",
      path: `event.staff[${index}].role`,
      message: "templateStaffRoles",
    });
  }

  if (issues.length) {
    return { success: false, issues };
  }

  // Retain duplicates in review so the final server result can report them.
  if (
    new TextEncoder().encode(JSON.stringify(parsed.data)).byteLength >
    TEMPLATE_LIMITS.bytes
  ) {
    return templateFailure("limit", "template", "templateSizeLimit");
  }

  return {
    success: true,
    template: parsed.data,
    duplicateWarnings: staff.duplicates,
  };
}

export function parseTemplateText(text: unknown): TemplateResult {
  if (typeof text !== "string") {
    return templateFailure("invalid_text", "template", "templateUploadPaste");
  }

  if (new TextEncoder().encode(text).byteLength > TEMPLATE_LIMITS.bytes) {
    return templateFailure("limit", "template", "templateSizeLimit");
  }

  let input: unknown;

  try {
    input = JSON.parse(text);
  } catch {
    return templateFailure("json", "template", "templateJsonInvalid");
  }

  return validateTemplateCreate(input);
}

export function templateCreateInput(event: TemplateEvent) {
  return { format: "event-flow-template", event };
}

// Review keys remain stable across edits/reorder. Check references BEFORE renumbering.

export function canonicalizeReview(event: TemplateEvent): TemplateResult {
  const issues = portableBindingIssues(event);
  const keys = new Map(
    event.registrationForm.fields.map((field, index) => [
      field.key,
      `field_${index + 1}`,
    ]),
  );

  if (keys.size !== event.registrationForm.fields.length) {
    issues.push({
      code: "field_identity",
      path: "event.registrationForm.fields",
      message: "templateQuestionIdentity",
    });
  }

  if (issues.length) {
    return { success: false, issues };
  }

  const binding = (
    value: NonNullable<TemplateEvent["badgeLayout"]>["secondaryField"],
  ) => (value ? { ...value, fieldKey: keys.get(value.fieldKey) ?? "" } : null);

  return validateTemplateCreate(
    templateCreateInput({
      ...event,
      registrationForm: {
        fields: event.registrationForm.fields.map((field) => ({
          ...field,
          key: keys.get(field.key) ?? "",
        })),
      },
      badgeLayout: event.badgeLayout
        ? {
            ...event.badgeLayout,
            secondaryField: binding(event.badgeLayout.secondaryField),
            tertiaryField: binding(event.badgeLayout.tertiaryField),
          }
        : null,
    }),
  );
}

export function templateEventValues(event: TemplateEvent) {
  const local = (instant: string | null) =>
    instant
      ? Temporal.Instant.from(instant)
          .toZonedDateTimeISO(event.timezone)
          .toPlainDateTime()
          .toString({ smallestUnit: "minute" })
      : "";

  return {
    location: event.location,
    publicOrganizer: event.publicOrganizer,
    schedule: scheduleFormValues(event.schedule, event.timezone),
    title: event.title,
    language: event.language,
    description: event.description ?? "",
    timezone: event.timezone,
    startsAt: local(event.startsAt),
    endsAt: local(event.endsAt),
    registrationOpensAt: local(event.registrationOpensAt),
    registrationClosesAt: local(event.registrationClosesAt),
    visibility: event.visibility,
    accountRequirement: event.accountRequirement,
    capacity: event.capacity?.toString() ?? "",
    maxGuestsPerRegistration: String(event.maxGuestsPerRegistration),
  };
}
