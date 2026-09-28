import Add from "@mui/icons-material/Add";
import ArrowForward from "@mui/icons-material/ArrowForward";
import EventOutlined from "@mui/icons-material/EventOutlined";
import {
  Box,
  Button,
  Chip,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { DateTime } from "@/components/ui/date-time";
import { publicationState } from "@/features/events/publication-state";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const organizer = await requireOrganizer();
  const { visibility } = await searchParams;
  const filter =
    visibility === "PUBLIC" || visibility === "PRIVATE" ? visibility : "ALL";
  const events = await prisma.event.findMany({
    where: { organizerId: organizer.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      visibility: true,
      startsAt: true,
      endsAt: true,
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
    <Stack spacing={4}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Stack spacing={1}>
          <Typography variant="h4" component="h1">
            My events
          </Typography>
          <Typography color="text.secondary">Manage your events.</Typography>
        </Stack>
        <Button
          href="/dashboard/events/new"
          variant="contained"
          startIcon={<Add />}
          sx={{ alignSelf: "flex-start", flexShrink: 0 }}
        >
          Create event
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
            href={`/dashboard${value === "ALL" ? "" : `?visibility=${value}`}`}
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
        <Paper
          variant="outlined"
          sx={{ p: { xs: 3, sm: 6 }, borderRadius: 2, textAlign: "center" }}
        >
          <Stack spacing={2} sx={{ alignItems: "center" }}>
            <EventOutlined sx={{ fontSize: 40, color: "text.secondary" }} />
            <Typography variant="h6" component="h2">
              {filter === "ALL"
                ? "Your first event starts here"
                : `No ${labels[filter].toLowerCase()} events`}
            </Typography>
            <Typography color="text.secondary">
              {filter === "ALL"
                ? "Create a draft to set the schedule and registration details."
                : `Your ${labels[filter].toLowerCase()} events will appear here.`}
            </Typography>
            <Button
              href="/dashboard/events/new"
              variant="contained"
              startIcon={<Add />}
            >
              Create event
            </Button>
          </Stack>
        </Paper>
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
              sx={{ p: 3, borderRadius: 2 }}
            >
              <Stack
                spacing={2}
                sx={{ height: "100%", alignItems: "flex-start" }}
              >
                <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
                  {filter === "ALL" && (
                    <Chip
                      label={labels[event.visibility]}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  <Chip
                    label={publicationState(event)}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                <Link
                  href={`/dashboard/events/${event.id}`}
                  variant="h6"
                  underline="hover"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {event.title}
                </Link>
                <Box sx={{ flexGrow: 1 }}>
                  <DateTime
                    date={event.startsAt}
                    endDate={event.endsAt}
                    timezone={event.timezone}
                  />
                </Box>
                <Button
                  href={`/dashboard/events/${event.id}`}
                  size="small"
                  endIcon={<ArrowForward />}
                >
                  View event
                </Button>
              </Stack>
            </Paper>
          ))}
        </Box>
      )}
    </Stack>
  );
}
