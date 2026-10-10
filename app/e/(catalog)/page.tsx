import ArrowForward from "@mui/icons-material/ArrowForward";
import EventOutlined from "@mui/icons-material/EventOutlined";
import {
  Box,
  Button,
  CardActionArea,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { Metadata } from "next";
import { connection } from "next/server";
import { DateTime } from "@/components/ui/date-time";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  EventCover,
  EventCoverBackdrop,
} from "@/features/events/components/event-cover";
import { EventDescription } from "@/features/events/components/event-description";
import { RegistrationAvailabilityStatus } from "@/features/events/components/registration-availability-status";
import { eventCoverImage } from "@/features/events/event-cover";
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
    <Stack spacing={3}>
      <PageHeader
        title="Public events"
        description="Explore events and discover your next experience."
      />
      {featured && (
        <Paper
          component="section"
          aria-labelledby="featured-event-title"
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 3 },
            aspectRatio: {
              xs: "auto",
              lg: featured.snapshot.cover ? "16 / 9" : "auto",
            },
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            position: "relative",
            overflow: "hidden",
            color: featured.snapshot.cover ? "#fff" : undefined,
            borderTop: featured.snapshot.cover ? undefined : 3,
            borderTopColor: "primary.main",
          }}
        >
          {featured.snapshot.cover && (
            <EventCoverBackdrop>
              <EventCover
                fill
                priority
                image={{
                  ...eventCoverImage(
                    featured.snapshot.cover,
                    `/e/${featured.publicId}/cover/${featured.snapshot.cover.assetId}`,
                  ),
                  sizes: "(min-width: 1200px) 1152px, calc(100vw - 32px)",
                }}
              />
            </EventCoverBackdrop>
          )}
          <Box
            sx={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 320px" },
              gap: 3,
            }}
          >
            <Stack spacing={2}>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  color: featured.snapshot.cover ? "inherit" : "primary.main",
                }}
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
                    fontSize: { xs: "2rem", sm: "2rem" },
                    fontWeight: 600,
                    overflowWrap: "anywhere",
                  }}
                >
                  {featured.snapshot.title}
                </Typography>
                {featured.snapshot.description && (
                  <Box
                    sx={{
                      color: featured.snapshot.cover
                        ? "rgba(255,255,255,0.85)"
                        : "text.secondary",
                      "& a": { color: "inherit", textDecoration: "underline" },
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 3,
                      overflow: "hidden",
                      overflowWrap: "anywhere",
                      maxWidth: 640,
                    }}
                  >
                    <EventDescription
                      text={featured.snapshot.description}
                      format={featured.snapshot.descriptionFormat}
                    />
                  </Box>
                )}
              </Stack>
            </Stack>
            <Stack
              spacing={2}
              sx={{
                justifyContent: "center",
                borderLeft: { md: 1 },
                borderColor: {
                  md: featured.snapshot.cover
                    ? "rgba(255,255,255,0.3)"
                    : "divider",
                },
                pl: { md: 3 },
              }}
            >
              <DateTime
                inverse={Boolean(featured.snapshot.cover)}
                date={featured.snapshot.startsAt}
                endDate={featured.snapshot.endsAt}
                timezone={featured.snapshot.timezone}
              />
              <RegistrationAvailabilityStatus
                inverse={Boolean(featured.snapshot.cover)}
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
          </Box>
        </Paper>
      )}
      {events.length === 0 ? (
        <EmptyState
          icon={<EventOutlined />}
          title="No public events yet"
          description="Check back soon for newly published events."
        />
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
                    sx={{
                      alignSelf: "start",
                      display: "flex",
                      position: "relative",
                      overflow: "hidden",
                      color: snapshot.cover ? "#fff" : undefined,
                    }}
                  >
                    <CardActionArea
                      href={`/e/${encodeURIComponent(publicId)}`}
                      aria-labelledby={`event-title-${publicId}`}
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        overflow: "hidden",
                        width: "100%",
                        aspectRatio: {
                          xs: "auto",
                          lg: snapshot.cover ? "16 / 9" : "auto",
                        },
                        borderRadius: "inherit",
                        "& .event-cover-image": {
                          transition: "transform 240ms ease",
                        },
                        "@media (hover: hover) and (pointer: fine)": {
                          "&:hover .event-cover-image": {
                            transform: "scale(1.1)",
                          },
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                          "& .event-cover-image": { transition: "none" },
                          "&:hover .event-cover-image": { transform: "none" },
                        },
                      }}
                    >
                      {snapshot.cover && (
                        <EventCoverBackdrop>
                          <EventCover
                            fill
                            image={{
                              ...eventCoverImage(
                                snapshot.cover,
                                `/e/${publicId}/cover/${snapshot.cover.assetId}`,
                              ),
                              sizes:
                                "(min-width: 1200px) 560px, (min-width: 600px) calc(50vw - 36px), calc(100vw - 32px)",
                            }}
                          />
                        </EventCoverBackdrop>
                      )}
                      <Stack
                        spacing={2}
                        useFlexGap
                        sx={{
                          position: "relative",
                          p: { xs: 2, sm: 3 },
                          width: "100%",
                          flexGrow: 1,
                          alignItems: "flex-start",
                          justifyContent: "flex-end",
                        }}
                      >
                        <Typography
                          id={`event-title-${publicId}`}
                          variant="h6"
                          component="h3"
                          color={snapshot.cover ? "inherit" : "primary.main"}
                          sx={{ overflowWrap: "anywhere", mb: "auto" }}
                        >
                          {snapshot.title}
                        </Typography>
                        <Box>
                          <DateTime
                            inverse={Boolean(snapshot.cover)}
                            date={snapshot.startsAt}
                            endDate={snapshot.endsAt}
                            timezone={snapshot.timezone}
                          />
                        </Box>
                        {group.id !== "past-events" && (
                          <RegistrationAvailabilityStatus
                            inverse={Boolean(snapshot.cover)}
                            snapshot={snapshot}
                            now={now}
                          />
                        )}
                      </Stack>
                    </CardActionArea>
                  </Paper>
                ))}
              </Box>
            </Stack>
          ))
      )}
    </Stack>
  );
}
