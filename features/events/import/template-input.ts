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
  type EventTemplateV2,
  eventTemplateV1Schema,
  eventTemplateV2Schema,
  TEMPLATE_V1_LIMITS,
} from "@/features/exports/event-template";

export type TemplateIssue = { code: string; path: string; message: string };

export type TemplateResult =
  | {
      success: true;
      template: EventTemplateV2;
      sourceVersion: 1 | 2;
      duplicateWarnings: string[];
    }
  | { success: false; issues: TemplateIssue[] };

export type TemplateEvent = EventTemplateV2["event"];

export type TemplateField = TemplateEvent["registrationForm"]["fields"][number];

const knownSegments = new Set([
  "descriptionFormat",
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
  "version",
  "event",
  "title",
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
          ? "Unknown properties are not allowed here."
          : "Check this value and the template's required format and limits.",
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
        message:
          "The selected question was removed or changed. Update this badge binding or restore the compatible question.",
      });
    }
  }

  return issues;
}

// Transport independent: Duplicate can later call this with projector output.

export function validateTemplateCreate(input: unknown): TemplateResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return templateFailure(
      "format",
      "template",
      "Use an Event Flow template object.",
    );
  }

  if (!("format" in input) || input.format !== "event-flow-template") {
    return templateFailure(
      "format",
      "format",
      "Expected event-flow-template format.",
    );
  }

  if (!("version" in input) || ![1, 2].includes(input.version as number)) {
    return templateFailure(
      "unsupported_version",
      "version",
      "Unsupported template version. Versions 1 and 2 are supported.",
    );
  }

  const parsed = (
    input.version === 1 ? eventTemplateV1Schema : eventTemplateV2Schema
  ).safeParse(input);

  if (!parsed.success) {
    // v1's binding/count refinements have root paths. Supply useful known paths
    // without echoing input or altering the accepted export contract.
    const issues = safeTemplateIssues(parsed.error);

    for (const [index, issue] of parsed.error.issues.slice(0, 30).entries()) {
      if (issue.message === "Invalid badge field binding.") {
        issues[index] = {
          code: "badge_binding",
          path: "event.badgeLayout",
          message:
            "Update the badge bindings to match the current question identity, type and label.",
        };
      } else if (issue.message === "Too many options.") {
        issues[index] = {
          code: "limit",
          path: "event.registrationForm.fields",
          message: "Use at most 1,000 options in total.",
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
      message: "The same email cannot have different roles. Choose one role.",
    });
  }

  if (issues.length) {
    return { success: false, issues };
  }

  // Retain duplicates in review so the final server result can report them.
  if (
    new TextEncoder().encode(JSON.stringify(parsed.data)).byteLength >
    TEMPLATE_V1_LIMITS.bytes
  ) {
    return templateFailure(
      "limit",
      "template",
      "The template must not exceed 512 KiB of UTF-8 JSON.",
    );
  }

  const template: EventTemplateV2 =
    parsed.data.version === 1
      ? {
          ...parsed.data,
          version: 2,
          event: {
            ...parsed.data.event,
            descriptionFormat: "PLAIN_TEXT",
            location: null,
            schedule: [],
            publicOrganizer: null,
            cover: { status: "NONE" },
          },
        }
      : parsed.data;

  return {
    success: true,
    template,
    sourceVersion: parsed.data.version,
    duplicateWarnings: staff.duplicates,
  };
}

export function parseTemplateText(text: unknown): TemplateResult {
  if (typeof text !== "string") {
    return templateFailure(
      "invalid_text",
      "template",
      "Upload or paste JSON text.",
    );
  }

  if (new TextEncoder().encode(text).byteLength > TEMPLATE_V1_LIMITS.bytes) {
    return templateFailure(
      "limit",
      "template",
      "The template must not exceed 512 KiB of UTF-8 JSON.",
    );
  }

  let input: unknown;

  try {
    input = JSON.parse(text);
  } catch {
    return templateFailure(
      "json",
      "template",
      "The text is not valid JSON. Check its syntax and try again.",
    );
  }

  return validateTemplateCreate(input);
}

// Keep legacy transport through Review/Create while all rich fields are defaults.
// A rich edit promotes the payload to strict V2; it is never silently dropped.
export function templateCreateInput(
  event: TemplateEvent,
  sourceVersion: 1 | 2,
) {
  const {
    descriptionFormat,
    location,
    schedule,
    publicOrganizer,
    cover,
    ...legacy
  } = event;

  if (
    sourceVersion === 1 &&
    descriptionFormat === "PLAIN_TEXT" &&
    location === null &&
    schedule.length === 0 &&
    publicOrganizer === null &&
    cover.status === "NONE"
  ) {
    return { format: "event-flow-template", version: 1, event: legacy };
  }

  return { format: "event-flow-template", version: 2, event };
}

// Review keys remain stable across edits/reorder. Check references BEFORE renumbering.

export function canonicalizeReview(
  event: TemplateEvent,
  sourceVersion: 1 | 2 = 2,
): TemplateResult {
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
      message: "Question identities must be unique.",
    });
  }

  if (issues.length) {
    return { success: false, issues };
  }

  const binding = (
    value: NonNullable<TemplateEvent["badgeLayout"]>["secondaryField"],
  ) => (value ? { ...value, fieldKey: keys.get(value.fieldKey) ?? "" } : null);

  return validateTemplateCreate(
    templateCreateInput(
      {
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
      },
      sourceVersion,
    ),
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
    descriptionFormat: event.descriptionFormat,
    location: event.location,
    publicOrganizer: event.publicOrganizer,
    schedule: scheduleFormValues(event.schedule, event.timezone),
    title: event.title,
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
