import ArrowForward from "@mui/icons-material/ArrowForward";
import EventOutlined from "@mui/icons-material/EventOutlined";
import { Box, Button, Link, Paper, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { connection } from "next/server";
import { RegistrationAvailabilityStatus } from "@/features/events/components/registration-availability-status";
import { formatEventTime } from "@/features/events/format-event-time";
import { formatTimezone } from "@/features/events/format-timezone";
import { getPublicEvents } from "@/features/events/server/get-public-events";

export const metadata: Metadata = {
  title: "Public events | Event Flow",
  description:
    "Explore public events on Event Flow and find out how to attend.",
};

export default async function PublicEventsPage() {
  await connection();
  const events = await getPublicEvents();
  const now = new Date();
  const instant = now.getTime();
  // The catalog is ordered by published start time, earliest first.
  const featured = events.find(
    ({ snapshot }) => Date.parse(snapshot.startsAt) > instant,
  );
  const remainingEvents = events.filter(
    (event) => event.publicId !== featured?.publicId,
  );
  const groups = [
    {
      id: "upcoming-events",
      title: "Upcoming events",
      events: remainingEvents.filter(
        ({ snapshot }) => Date.parse(snapshot.startsAt) > instant,
      ),
    },
    {
      id: "ongoing-events",
      title: "Happening now",
      events: remainingEvents.filter(
        ({ snapshot }) =>
          Date.parse(snapshot.startsAt) <= instant &&
          instant < Date.parse(snapshot.endsAt),
      ),
    },
    {
      id: "past-events",
      title: "Past events",
      events: remainingEvents.filter(
        ({ snapshot }) => Date.parse(snapshot.endsAt) <= instant,
      ),
    },
  ];

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          Public events
        </Typography>
        <Typography color="text.secondary">
          Explore events and discover your next experience.
        </Typography>
      </Stack>
      {featured && (
        <Paper
          component="section"
          aria-labelledby="featured-event-title"
          variant="outlined"
          sx={{
            p: { xs: 3, sm: 5 },
            borderRadius: 3,
            borderColor: "primary.main",
            bgcolor: "action.hover",
          }}
        >
          <Stack spacing={3}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", color: "primary.main" }}
            >
              <EventOutlined fontSize="small" />
              <Typography variant="overline" sx={{ fontWeight: 700 }}>
                Up next
              </Typography>
            </Stack>
            <Stack spacing={2}>
              <Typography
                id="featured-event-title"
                component="h2"
                variant="h3"
                sx={{
                  fontSize: { xs: "2rem", sm: "2.75rem" },
                  fontWeight: 600,
                  overflowWrap: "anywhere",
                }}
              >
                {featured.snapshot.title}
              </Typography>
              {featured.snapshot.description && (
                <Typography
                  color="text.secondary"
                  sx={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 3,
                    overflow: "hidden",
                    overflowWrap: "anywhere",
                    whiteSpace: "pre-line",
                    maxWidth: 640,
                  }}
                >
                  {featured.snapshot.description}
                </Typography>
              )}
            </Stack>
            <Stack spacing={0.5}>
              <Typography sx={{ fontWeight: 500 }}>
                {formatEventTime(
                  new Date(featured.snapshot.startsAt),
                  featured.snapshot.timezone,
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Until{" "}
                {formatEventTime(
                  new Date(featured.snapshot.endsAt),
                  featured.snapshot.timezone,
                )}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ overflowWrap: "anywhere" }}
              >
                {formatTimezone(featured.snapshot.timezone)}
              </Typography>
            </Stack>
            <RegistrationAvailabilityStatus
              snapshot={featured.snapshot}
              now={now}
            />
            <Button
              href={`/e/${encodeURIComponent(featured.publicId)}`}
              variant="contained"
              endIcon={<ArrowForward />}
              sx={{ alignSelf: "flex-start" }}
            >
              View event
            </Button>
          </Stack>
        </Paper>
      )}
      {events.length === 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, borderRadius: 2 }}>
          <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
            <EventOutlined sx={{ fontSize: 40, color: "text.secondary" }} />
            <Typography variant="h6" component="h2">
              No public events yet
            </Typography>
            <Typography color="text.secondary">
              Check back soon for newly published events.
            </Typography>
          </Stack>
        </Paper>
      ) : (
        groups
          .filter((group) => group.events.length > 0)
          .map((group) => (
            <Stack
              component="section"
              aria-labelledby={group.id}
              key={group.id}
              spacing={2}
            >
              <Typography id={group.id} variant="h5" component="h2">
                {group.title}
              </Typography>
              <Box
                component="ul"
                sx={{
                  listStyle: "none",
                  p: 0,
                  m: 0,
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    sm: "repeat(2, minmax(0, 1fr))",
                  },
                }}
              >
                {group.events.map(({ publicId, snapshot }) => (
                  <Paper
                    key={publicId}
                    component="li"
                    variant="outlined"
                    sx={{ p: 3, borderRadius: 2 }}
                  >
                    <Stack
                      spacing={2}
                      sx={{ height: "100%", alignItems: "flex-start" }}
                    >
                      <Typography
                        variant="h6"
                        component="h3"
                        sx={{ overflowWrap: "anywhere" }}
                      >
                        <Link
                          href={`/e/${encodeURIComponent(publicId)}`}
                          underline="hover"
                        >
                          {snapshot.title}
                        </Link>
                      </Typography>
                      <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
                        <Typography>
                          {formatEventTime(
                            new Date(snapshot.startsAt),
                            snapshot.timezone,
                          )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Until{" "}
                          {formatEventTime(
                            new Date(snapshot.endsAt),
                            snapshot.timezone,
                          )}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ overflowWrap: "anywhere" }}
                        >
                          {formatTimezone(snapshot.timezone)}
                        </Typography>
                      </Stack>
                      {group.id !== "past-events" && (
                        <RegistrationAvailabilityStatus
                          snapshot={snapshot}
                          now={now}
                        />
                      )}
                      <Button
                        href={`/e/${encodeURIComponent(publicId)}`}
                        size="small"
                        endIcon={<ArrowForward />}
                      >
                        View event
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </Stack>
          ))
      )}
    </Stack>
  );
}
