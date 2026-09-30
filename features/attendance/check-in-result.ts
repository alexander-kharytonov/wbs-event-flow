type AttendeePresentation = {
  kind: "PRIMARY" | "GUEST";
  attendeeName: string;
  attendeeEmail: string | null;
  ticketNumber: string;
};

export type CheckInDecision =
  | { code: "CHECKED_IN" | "ALREADY_CHECKED_IN"; checkedInAt: string }
  | { code: "ADMISSION_REVOKED" | "EVENT_CANCELLED" }
  | { code: "CHECK_IN_NOT_OPEN" | "CHECK_IN_CLOSED"; boundaryAt: string };

type CheckInFailure = { code: "UNAVAILABLE" | "FAILED"; message: string };

export type ManualCheckInResult = CheckInDecision | CheckInFailure;

export type CheckInResult =
  | (CheckInDecision & { attendee: AttendeePresentation })
  | { code: "INVALID_CREDENTIAL" | "WRONG_EVENT" }
  | CheckInFailure;
