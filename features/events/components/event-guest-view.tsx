import { Alert, Divider, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { formatEventTime } from "@/features/events/format-event-time";
import { formatTimezone } from "@/features/events/format-timezone";
import {
  registrationAvailability,
  registrationDeadline,
} from "@/features/events/registration-availability";
import type { EventSnapshot } from "@/features/events/schemas/event-snapshot";

export function EventGuestView({
  snapshot,
  now,
  approved,
  children,
}: {
  snapshot: EventSnapshot;
  now: Date;
  approved?: number;
  children?: ReactNode;
}) {
  const state = registrationAvailability(snapshot, now);
  const hasEnded = now.getTime() >= Date.parse(snapshot.endsAt);
  const format = (instant: string) =>
    formatEventTime(new Date(instant), snapshot.timezone);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 4 }, borderRadius: 2 }}>
      <Stack
        spacing={3}
        sx={{ maxWidth: 760, mx: "auto", overflowWrap: "anywhere" }}
      >
        <Stack spacing={1}>
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontSize: { xs: "2rem", sm: "2.5rem" } }}
          >
            {snapshot.title}
          </Typography>
          <Typography>
            {format(snapshot.startsAt)} – {format(snapshot.endsAt)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All times in {formatTimezone(snapshot.timezone)}
          </Typography>
        </Stack>
        {snapshot.description && (
          <Typography sx={{ whiteSpace: "pre-wrap" }}>
            {snapshot.description}
          </Typography>
        )}
        <Divider />
        <Stack spacing={1.5}>
          <Typography variant="h6" component="h2">
            Registration
          </Typography>
          {!hasEnded && (
            <Alert severity={state === "OPEN" ? "success" : "info"}>
              {state === "NOT_OPEN_YET" && snapshot.registrationOpensAt
                ? `Registration opens on ${format(snapshot.registrationOpensAt)}.`
                : state === "CLOSED"
                  ? "Registration is closed."
                  : "Registration is open."}
            </Alert>
          )}
          {snapshot.registrationOpensAt && (
            <Typography>
              Opens: {format(snapshot.registrationOpensAt)}
            </Typography>
          )}
          <Typography>
            Closes: {format(registrationDeadline(snapshot))}
          </Typography>
          {!hasEnded && snapshot.capacity === null ? (
            <Typography>Unlimited capacity</Typography>
          ) : !hasEnded &&
            snapshot.capacity !== null &&
            approved !== undefined ? (
            <Stack spacing={1}>
              <Typography>
                {approved} of {snapshot.capacity} places filled ·{" "}
                {Math.max(0, snapshot.capacity - approved)} available
              </Typography>
              {approved >= snapshot.capacity && state === "OPEN" && (
                <Typography variant="body2" color="text.secondary">
                  All places are currently filled. You can still apply — a place
                  may become available.
                </Typography>
              )}
            </Stack>
          ) : (
            snapshot.capacity !== null && (
              <Typography>Guest capacity: {snapshot.capacity}</Typography>
            )
          )}
          {snapshot.accountRequirement === "REQUIRED" && (
            <Typography color="text.secondary">
              An Event Flow account will be required to register.
            </Typography>
          )}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}
