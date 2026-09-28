import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { DateTime } from "@/components/ui/date-time";
import { formatEventTime } from "@/features/events/format-event-time";
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
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={3} sx={{ overflowWrap: "anywhere" }}>
        <Stack spacing={1}>
          <Typography variant="overline" color="primary.main">
            {hasEnded ? "Past event" : "Event details"}
          </Typography>
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontSize: { xs: "2rem", sm: "2.5rem" } }}
          >
            {snapshot.title}
          </Typography>
          <DateTime
            date={snapshot.startsAt}
            endDate={snapshot.endsAt}
            timezone={snapshot.timezone}
          />
          <Button
            href="#event-registration"
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
          >
            Registration details
          </Button>
        </Stack>
        {snapshot.description && (
          <Typography sx={{ whiteSpace: "pre-wrap", maxWidth: "80ch" }}>
            {snapshot.description}
          </Typography>
        )}
        <Paper
          component="section"
          variant="outlined"
          id="event-registration"
          aria-labelledby="event-registration-title"
          tabIndex={-1}
          sx={{ p: { xs: 2, sm: 3 }, bgcolor: "background.default" }}
        >
          <Stack spacing={3}>
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                flexWrap: "wrap",
              }}
            >
              <Typography
                id="event-registration-title"
                variant="h6"
                component="h2"
              >
                Registration
              </Typography>
              <Chip
                size="small"
                label={
                  hasEnded
                    ? "Event ended"
                    : state === "OPEN"
                      ? "Open"
                      : state === "NOT_OPEN_YET"
                        ? "Not open yet"
                        : "Closed"
                }
                color={
                  state === "OPEN"
                    ? "success"
                    : state === "NOT_OPEN_YET"
                      ? "info"
                      : "default"
                }
                variant="outlined"
              />
            </Stack>
            <Box
              component="dl"
              sx={{
                m: 0,
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  sm: "repeat(2, minmax(0, 1fr))",
                },
                gap: 3,
                "& dt": {
                  typography: "body2",
                  color: "text.secondary",
                  mb: 0.5,
                },
                "& dd": { m: 0, typography: "body1", fontWeight: 600 },
              }}
            >
              <Box>
                <Typography component="dt">Registration opens</Typography>
                <Typography component="dd">
                  {snapshot.registrationOpensAt
                    ? format(snapshot.registrationOpensAt)
                    : "On publication"}
                </Typography>
              </Box>
              <Box>
                <Typography component="dt">Registration closes</Typography>
                <Typography component="dd">
                  {format(registrationDeadline(snapshot))}
                </Typography>
              </Box>
              <Box>
                <Typography component="dt">
                  {!hasEnded &&
                  approved !== undefined &&
                  snapshot.capacity !== null
                    ? "Places available"
                    : "Guest capacity"}
                </Typography>
                <Typography component="dd">
                  {snapshot.capacity === null
                    ? "No limit"
                    : !hasEnded && approved !== undefined
                      ? Math.max(0, snapshot.capacity - approved)
                      : `${snapshot.capacity} guests`}
                  {!hasEnded &&
                    approved !== undefined &&
                    snapshot.capacity !== null && (
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5, display: "block", fontWeight: 400 }}
                      >
                        {approved} of {snapshot.capacity} places filled
                      </Typography>
                    )}
                </Typography>
              </Box>
              <Box>
                <Typography component="dt">Event Flow account</Typography>
                <Typography component="dd">
                  {snapshot.accountRequirement === "REQUIRED"
                    ? "Verified account required"
                    : "Optional"}
                </Typography>
              </Box>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}
            >
              All times in {snapshot.timezone}.
              {hasEnded && " This event has ended. Registration is closed."}
              {!hasEnded &&
                snapshot.capacity !== null &&
                approved !== undefined &&
                approved >= snapshot.capacity &&
                state === "OPEN" &&
                " All places are currently filled. You can still apply — a place may become available."}
            </Typography>
          </Stack>
        </Paper>
        {children}
      </Stack>
    </Paper>
  );
}
