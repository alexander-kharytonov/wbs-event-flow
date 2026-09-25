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
import { formatEventTime } from "@/features/events/format-event-time";
import { formatTimezone } from "@/features/events/format-timezone";
import { publicationState } from "@/features/events/publication-state";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const organizer = await requireOrganizer();
  const events = await prisma.event.findMany({
    where: { organizerId: organizer.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      startsAt: true,
      timezone: true,
      contentVersion: true,
      publishedRevision: { select: { contentVersion: true } },
    },
  });

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
      {events.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ p: { xs: 3, sm: 6 }, borderRadius: 2, textAlign: "center" }}
        >
          <Stack spacing={2} sx={{ alignItems: "center" }}>
            <EventOutlined sx={{ fontSize: 40, color: "text.secondary" }} />
            <Typography variant="h6" component="h2">
              Your first event starts here
            </Typography>
            <Typography color="text.secondary">
              Create a draft to set the schedule and registration details.
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
          {events.map((event) => (
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
                <Chip
                  label={publicationState(event)}
                  size="small"
                  variant="outlined"
                />
                <Link
                  href={`/dashboard/events/${event.id}`}
                  variant="h6"
                  underline="hover"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {event.title}
                </Link>
                <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
                  <Typography>
                    {formatEventTime(event.startsAt, event.timezone)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {formatTimezone(event.timezone)}
                  </Typography>
                </Stack>
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
