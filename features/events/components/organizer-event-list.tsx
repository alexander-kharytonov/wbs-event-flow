import Add from "@mui/icons-material/Add";
import EventOutlined from "@mui/icons-material/EventOutlined";
import LinkOutlined from "@mui/icons-material/LinkOutlined";
import PublicOutlined from "@mui/icons-material/PublicOutlined";
import {
  Box,
  Button,
  CardActionArea,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { DateTime } from "@/components/ui/date-time";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { EventLifecycleStatus } from "@/features/events/components/event-lifecycle-status";
import { PublicationStatus } from "@/features/events/components/publication-status";
import { publicationState } from "@/features/events/publication-state";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export async function OrganizerEventList({
  archived,
  visibility,
}: {
  archived: boolean;
  visibility?: string | string[];
}) {
  const organizer = await requireOrganizer();
  const basePath = archived ? "/dashboard/archived" : "/dashboard";
  const filter =
    visibility === "PUBLIC" || visibility === "PRIVATE" ? visibility : "ALL";
  const events = await prisma.event.findMany({
    where: {
      organizerId: organizer.id,
      archivedAt: archived ? { not: null } : null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      publicId: true,
      title: true,
      visibility: true,
      startsAt: true,
      endsAt: true,
      cancelledAt: true,
      archivedAt: true,
      timezone: true,
      contentVersion: true,
      publishedRevision: { select: { contentVersion: true } },
    },
  });

  const counts = { ALL: events.length, PUBLIC: 0, PRIVATE: 0 };

  for (const event of events) {
    counts[event.visibility] += 1;
  }

  const visibleEvents = events.filter(
    (event) => filter === "ALL" || event.visibility === filter,
  );
  const labels = { ALL: "All", PUBLIC: "Public", PRIVATE: "Private" };

  return (
    <Stack spacing={3}>
      <PageHeader
        title={archived ? "Archived events" : "My events"}
        description={
          archived
            ? "Review archived events and their application history."
            : "Manage your events, registration forms, and applications."
        }
        actions={
          !archived && (
            <Button
              href="/dashboard/events/new"
              variant="contained"
              startIcon={<Add />}
            >
              Create event
            </Button>
          )
        }
      />
      <Stack
        component="nav"
        aria-label="Event sections"
        direction="row"
        sx={{
          gap: 1,
          borderBottom: 1,
          borderColor: "divider",
          pb: 1,
          overflowX: "auto",
          "& .MuiButton-root": { flexShrink: 0 },
          "& [aria-current=page]": {
            bgcolor: "action.selected",
            boxShadow: "inset 0 -2px var(--mui-palette-primary-main)",
            fontWeight: 700,
          },
        }}
      >
        <Button
          href="/dashboard"
          variant="text"
          color={!archived ? "primary" : "inherit"}
          aria-current={!archived ? "page" : undefined}
          sx={{ px: 1.5 }}
        >
          Active
        </Button>
        <Button
          href="/dashboard/archived"
          variant="text"
          color={archived ? "primary" : "inherit"}
          aria-current={archived ? "page" : undefined}
          sx={{ px: 1.5 }}
        >
          Archived
        </Button>
      </Stack>
      <Stack
        component="nav"
        aria-label="Filter events"
        direction="row"
        sx={{ flexWrap: "wrap", gap: 1 }}
      >
        {(["ALL", "PUBLIC", "PRIVATE"] as const).map((value) => (
          <Button
            key={value}
            href={
              value === "ALL" ? basePath : `${basePath}?visibility=${value}`
            }
            variant={filter === value ? "contained" : "text"}
            color={filter === value ? "primary" : "inherit"}
            aria-current={filter === value ? "page" : undefined}
            aria-label={`${labels[value]} (${counts[value]})`}
            sx={{ px: 1.5 }}
          >
            {`${labels[value]} (${counts[value]})`}
          </Button>
        ))}
      </Stack>
      {visibleEvents.length === 0 ? (
        <EmptyState
          icon={<EventOutlined />}
          title={
            archived
              ? filter === "ALL"
                ? "No archived events"
                : `No archived ${labels[filter].toLowerCase()} events`
              : filter === "ALL"
                ? "Your first event starts here"
                : `No ${labels[filter].toLowerCase()} events`
          }
          description={
            archived
              ? filter === "ALL"
                ? "Completed and cancelled events you archive will appear here."
                : `Archived ${labels[filter].toLowerCase()} events will appear here. You can archive completed or cancelled events from My events.`
              : filter === "ALL"
                ? "Create a draft to set the schedule and registration details."
                : `Your ${labels[filter].toLowerCase()} events will appear here.`
          }
          action={
            archived ? (
              <Button href="/dashboard" variant="outlined">
                Back to My events
              </Button>
            ) : (
              <Button
                href="/dashboard/events/new"
                variant="contained"
                startIcon={<Add />}
              >
                Create event
              </Button>
            )
          }
        />
      ) : (
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
          {visibleEvents.map((event) => (
            <Paper
              component="li"
              variant="outlined"
              key={event.id}
              sx={{
                opacity: event.cancelledAt ? 0.5 : 1,
              }}
            >
              <CardActionArea
                href={`/dashboard/events/${event.id}`}
                aria-labelledby={`event-title-${event.id}`}
                sx={{
                  p: { xs: 2, sm: 3 },
                  height: "100%",
                  borderRadius: "inherit",
                }}
              >
                <Stack
                  spacing={2}
                  sx={{ height: "100%", alignItems: "flex-start" }}
                >
                  <Stack
                    direction="row"
                    sx={{
                      width: "100%",
                      gap: 1.5,
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ alignItems: "center", color: "text.secondary" }}
                    >
                      {event.visibility === "PUBLIC" ? (
                        <PublicOutlined sx={{ fontSize: 16 }} />
                      ) : (
                        <LinkOutlined sx={{ fontSize: 16 }} />
                      )}
                      <Typography variant="body2">
                        {labels[event.visibility]}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <EventLifecycleStatus event={event} now={new Date()} />
                      <PublicationStatus state={publicationState(event)} />
                    </Stack>
                  </Stack>
                  <Typography
                    id={`event-title-${event.id}`}
                    component="h2"
                    variant="h6"
                    color="primary.main"
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {event.title}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }}>
                    <DateTime
                      date={event.startsAt}
                      endDate={event.endsAt}
                      timezone={event.timezone}
                    />
                  </Box>
                </Stack>
              </CardActionArea>
            </Paper>
          ))}
        </Box>
      )}
    </Stack>
  );
}
