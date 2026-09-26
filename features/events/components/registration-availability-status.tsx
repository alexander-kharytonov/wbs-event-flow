import { Chip, Stack, Typography } from "@mui/material";
import { formatEventTime } from "@/features/events/format-event-time";
import { formatTimezone } from "@/features/events/format-timezone";
import { registrationAvailability } from "@/features/events/registration-availability";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

export function RegistrationAvailabilityStatus({
  snapshot,
  now,
}: {
  snapshot: Pick<
    EventSnapshot,
    "registrationOpensAt" | "registrationClosesAt" | "timezone"
  >;
  now: Date;
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
      : snapshot.registrationClosesAt;
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
      />
      {boundary && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ overflowWrap: "anywhere" }}
        >
          {timing} {formatEventTime(new Date(boundary), snapshot.timezone)} (
          {formatTimezone(snapshot.timezone)})
        </Typography>
      )}
    </Stack>
  );
}
