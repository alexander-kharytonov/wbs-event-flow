import { Chip, Stack, Typography } from "@mui/material";
import { formatEventTime } from "@/features/events/format-event-time";
import { formatTimezone } from "@/features/events/format-timezone";
import {
  registrationAvailability,
  registrationDeadline,
} from "@/features/events/registration-availability";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

export function RegistrationAvailabilityStatus({
  snapshot,
  now,
  inverse = false,
}: {
  snapshot: Pick<
    EventSnapshot,
    "endsAt" | "registrationOpensAt" | "registrationClosesAt" | "timezone"
  >;
  now: Date;
  inverse?: boolean;
}) {
  const status = registrationAvailability(snapshot, now);
  const labels = {
    OPEN: "Registration open",
    NOT_OPEN_YET: "Registration not open yet",
    CLOSED: "Registration closed",
  };
  const boundary =
    status === "NOT_OPEN_YET"
      ? snapshot.registrationOpensAt
      : registrationDeadline(snapshot);
  const timing =
    status === "NOT_OPEN_YET"
      ? "Opens"
      : status === "OPEN"
        ? "Closes"
        : "Closed";

  return (
    <Stack spacing={0.75} sx={{ alignItems: "flex-start" }}>
      <Chip
        label={labels[status]}
        color={
          status === "OPEN"
            ? "success"
            : status === "NOT_OPEN_YET"
              ? "info"
              : "default"
        }
        size="small"
        variant="outlined"
        sx={
          inverse
            ? { color: "#fff", borderColor: "rgba(255,255,255,0.5)" }
            : undefined
        }
      />
      {boundary && (
        <Typography
          variant="body2"
          color={inverse ? "rgba(255,255,255,0.85)" : "text.secondary"}
          sx={{ overflowWrap: "anywhere" }}
        >
          {timing} {formatEventTime(new Date(boundary), snapshot.timezone)} (
          {formatTimezone(snapshot.timezone)})
        </Typography>
      )}
    </Stack>
  );
}
