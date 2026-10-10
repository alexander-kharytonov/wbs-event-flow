import type { EventFormValues } from "@/features/events/event-input-schema";

export const editorSections = [
  { id: "basics", label: "Basics" },
  { id: "cover", label: "Cover" },
  { id: "schedule", label: "Schedule" },
  { id: "location", label: "Location" },
  { id: "agenda", label: "Event agenda" },
  { id: "registration", label: "Registration" },
  { id: "organizer", label: "Organizer" },
  { id: "additional", label: "Additional settings" },
] as const;

export type EditorSection = (typeof editorSections)[number]["id"];

export function errorSection(field: string): EditorSection | undefined {
  const root = field.split(".")[0];

  if (["title", "description", "descriptionFormat"].includes(root)) {
    return "basics";
  }

  if (["startsAt", "endsAt", "timezone"].includes(root)) {
    return "schedule";
  }

  if (root === "location") {
    return "location";
  }

  if (root === "schedule") {
    return "agenda";
  }

  if (root === "review") {
    return "additional";
  }

  if (root === "publicOrganizer") {
    return "organizer";
  }

  if (
    [
      "capacity",
      "maxGuestsPerRegistration",
      "registrationOpensAt",
      "registrationClosesAt",
      "visibility",
      "accountRequirement",
    ].includes(root)
  ) {
    return "registration";
  }

  return undefined;
}

// Include preservation markers: touching an ambiguous minute is a meaningful edit.
export function editorFingerprint(
  values: EventFormValues,
  editedDates: readonly string[],
) {
  return JSON.stringify({ values, editedDates: [...editedDates].sort() });
}

// A save reorders the authoritative schedule source; keep UI keys while adopting its new indices.
export function rebaseSavedValues(
  saved: EventFormValues,
  current: EventFormValues,
): EventFormValues {
  return {
    ...saved,
    schedule: saved.schedule.map((row, index) => ({
      ...row,
      key: current.schedule[index].key,
    })),
  };
}
