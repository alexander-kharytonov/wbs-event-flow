type AttendeePresentation = {
  kind: "PRIMARY" | "GUEST";
  attendeeName: string;
  attendeeEmail: string | null;
  ticketNumber: string;
};

export type CheckInResult =
  | {
      code: "CHECKED_IN" | "ALREADY_CHECKED_IN";
      attendee: AttendeePresentation;
      checkedInAt: string;
    }
  | {
      code: "ADMISSION_REVOKED" | "EVENT_CANCELLED";
      attendee: AttendeePresentation;
    }
  | {
      code: "CHECK_IN_NOT_OPEN" | "CHECK_IN_CLOSED";
      attendee: AttendeePresentation;
      boundaryAt: string;
    }
  | { code: "INVALID_CREDENTIAL" | "WRONG_EVENT" }
  | { code: "UNAVAILABLE" | "FAILED"; message: string };
