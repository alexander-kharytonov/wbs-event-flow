import type { ManualAudience } from "@/features/communications/server/contracts";
import type { Messages } from "@/lib/i18n/messages";

export const manualAudiences = [
  {
    value: "ALL_ACTIVE_ATTENDEES",
    label: "commAudienceAll",
    description: "commAudienceAllHint",
  },
  {
    value: "PRIMARY_ATTENDEES",
    label: "commAudiencePrimary",
    description: "commAudiencePrimaryHint",
  },
  {
    value: "CHECKED_IN",
    label: "checkedIn",
    description: "commAudienceArrivedHint",
  },
  {
    value: "NOT_ARRIVED",
    label: "commAudienceNotArrived",
    description: "commAudienceNotArrivedHint",
  },
  {
    value: "PENDING_APPLICATIONS",
    label: "commAudiencePending",
    description: "commAudiencePendingHint",
  },
  {
    value: "EVENT_STAFF",
    label: "commAudienceStaff",
    description: "commAudienceStaffHint",
  },
] as const satisfies readonly {
  value: ManualAudience;
  label: keyof Messages["events"];
  description: keyof Messages["events"];
}[];

export function audienceLabel(audience: string | null) {
  return (
    manualAudiences.find((option) => option.value === audience)?.label ?? null
  );
}
