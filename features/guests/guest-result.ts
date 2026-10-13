import type { Messages } from "@/lib/i18n/messages";

export type GuestResult = {
  fieldErrors?: Record<string, keyof Messages["events"]>;
  code:
    | "REMOVED"
    | "ALREADY_REMOVED"
    | "UNAVAILABLE"
    | "PARTY_FROZEN"
    | "EVENT_CANCELLED"
    | "REGISTRATION_REVOKED"
    | "FAILED";
};
