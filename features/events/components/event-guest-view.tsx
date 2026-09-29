import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
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
  cancelled = false,
  cancellationReason,
  now,
  occupied,
  children,
  notice,
  showApplicationLink = false,
}: {
  cancelled?: boolean;
  cancellationReason?: string | null;
  snapshot: EventSnapshot;
  now: Date;
  occupied?: number;
  children?: ReactNode;
  notice?: ReactNode;
  showApplicationLink?: boolean;
}) {
  const state = cancelled ? "CLOSED" : registrationAvailability(snapshot, now);
  const hasEnded = now.getTime() >= Date.parse(snapshot.endsAt);
  const format = (instant: string) =>
    formatEventTime(new Date(instant), snapshot.timezone);

  return (
    <Box>
      <Stack spacing={4} sx={{ overflowWrap: "anywhere" }}>
        <Stack
          spacing={2}
          sx={{ pb: 3, borderBottom: 1, borderColor: "divider" }}
        >
          <Typography variant="overline" color="primary.main">
            {cancelled
              ? "Event cancelled"
              : hasEnded
                ? "Past event"
                : "Event details"}
          </Typography>
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontSize: { xs: "2rem", sm: "2.5rem" } }}
          >
            {snapshot.title}
          </Typography>
          {cancelled && (
            <Alert severity="error" sx={{ whiteSpace: "pre-wrap" }}>
              <AlertTitle>Event cancelled</AlertTitle>
              {cancellationReason}
            </Alert>
          )}
          <DateTime
            date={snapshot.startsAt}
            endDate={snapshot.endsAt}
            timezone={snapshot.timezone}
          />
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            {showApplicationLink && (
              <Button href="#event-application" variant="contained">
                Apply to attend
              </Button>
            )}
            <Button href="#event-registration" variant="outlined">
              Registration details
            </Button>
          </Stack>
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "minmax(0, 1fr) 320px",
            },
            gap: { xs: 3, md: 4 },
            alignItems: "start",
          }}
        >
          <Stack spacing={4} sx={{ minWidth: 0 }}>
            {snapshot.description && (
              <Typography sx={{ whiteSpace: "pre-wrap", maxWidth: "80ch" }}>
                {snapshot.description}
              </Typography>
            )}
            <Box
              id="event-application"
              tabIndex={-1}
              sx={{
                "&:empty": { display: "none" },
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                p: { xs: 2, sm: 3 },
              }}
            >
              {children}
            </Box>
          </Stack>
          <Paper
            component="section"
            variant="outlined"
            id="event-registration"
            aria-labelledby="event-registration-title"
            tabIndex={-1}
            sx={{ p: 3, order: { xs: -1, md: 0 } }}
          >
            <Stack spacing={2}>
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
                    cancelled
                      ? "Cancelled"
                      : hasEnded
                        ? "Event ended"
                        : state === "OPEN"
                          ? "Open"
                          : state === "NOT_OPEN_YET"
                            ? "Not open yet"
                            : "Closed"
                  }
                  color={
                    cancelled
                      ? "error"
                      : state === "OPEN"
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
                    md: "minmax(0, 1fr)",
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
                    occupied !== undefined &&
                    snapshot.capacity !== null
                      ? "Places available"
                      : "Guest capacity"}
                  </Typography>
                  <Typography component="dd">
                    {snapshot.capacity === null
                      ? "No limit"
                      : !hasEnded && occupied !== undefined
                        ? Math.max(0, snapshot.capacity - occupied)
                        : `${snapshot.capacity} guests`}
                    {!hasEnded &&
                      occupied !== undefined &&
                      snapshot.capacity !== null && (
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5, display: "block", fontWeight: 400 }}
                        >
                          {occupied} of {snapshot.capacity} places filled
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
                  occupied !== undefined &&
                  occupied >= snapshot.capacity &&
                  state === "OPEN" &&
                  " All places are currently filled. You can still apply — a place may become available."}
              </Typography>
              <Stack
                spacing={2}
                sx={{
                  pt: 2,
                  borderTop: 1,
                  borderColor: "divider",
                  "&:empty": { display: "none" },
                }}
              >
                {notice}
              </Stack>
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </Box>
  );
}
