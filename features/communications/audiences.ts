import type { ManualAudience } from "@/features/communications/server/contracts";

export const manualAudiences = [
  {
    value: "ALL_ACTIVE_ATTENDEES",
    label: "All active attendees",
    description:
      "Primary attendees and guests with active admission and a valid email.",
  },
  {
    value: "PRIMARY_ATTENDEES",
    label: "Primary attendees",
    description: "Primary attendees with active admission.",
  },
  {
    value: "CHECKED_IN",
    label: "Checked in",
    description: "Active attendees whose arrival has been recorded.",
  },
  {
    value: "NOT_ARRIVED",
    label: "Not arrived",
    description: "Active attendees without a recorded arrival.",
  },
  {
    value: "PENDING_APPLICATIONS",
    label: "Pending applications",
    description: "Applicants whose current application is awaiting review.",
  },
  {
    value: "EVENT_STAFF",
    label: "Event staff",
    description: "The event owner, managers and reception staff.",
  },
] as const satisfies readonly {
  value: ManualAudience;
  label: string;
  description: string;
}[];

export function audienceLabel(audience: string | null) {
  return (
    manualAudiences.find((option) => option.value === audience)?.label ??
    audience
  );
}
