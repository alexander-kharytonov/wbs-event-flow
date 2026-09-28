import Add from "@mui/icons-material/Add";
import ArrowForward from "@mui/icons-material/ArrowForward";
import EventOutlined from "@mui/icons-material/EventOutlined";
import LinkOutlined from "@mui/icons-material/LinkOutlined";
import PublicOutlined from "@mui/icons-material/PublicOutlined";
import { Box, Button, Link, Paper, Stack, Typography } from "@mui/material";
import { DateTime } from "@/components/ui/date-time";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PublicationStatus } from "@/features/events/components/publication-status";
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
    <Stack spacing={3}>
      <PageHeader
        title="My events"
        description="Manage your events, registration forms, and applications."
        actions={
          <Button
            href="/dashboard/events/new"
            variant="contained"
            startIcon={<Add />}
          >
            Create event
          </Button>
        }
      />
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
        <EmptyState
          icon={<EventOutlined />}
          title={
            filter === "ALL"
              ? "Your first event starts here"
              : `No ${labels[filter].toLowerCase()} events`
          }
          description={
            filter === "ALL"
              ? "Create a draft to set the schedule and registration details."
              : `Your ${labels[filter].toLowerCase()} events will appear here.`
          }
          action={
            <Button
              href="/dashboard/events/new"
              variant="contained"
              startIcon={<Add />}
            >
              Create event
            </Button>
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
              sx={{ p: { xs: 2, sm: 3 } }}
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
                  <PublicationStatus state={publicationState(event)} />
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
