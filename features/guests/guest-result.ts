export type GuestResult = {
  code:
    | "ADDED"
    | "REMOVED"
    | "ALREADY_REMOVED"
    | "UNAVAILABLE"
    | "GUEST_LIMIT_REACHED"
    | "CAPACITY_REACHED"
    | "GUESTS_NOT_ALLOWED"
    | "NOT_PUBLISHED"
    | "PARTY_FROZEN"
    | "EVENT_CANCELLED"
    | "REGISTRATION_REVOKED"
    | "INVALID_INPUT"
    | "FAILED";
};
