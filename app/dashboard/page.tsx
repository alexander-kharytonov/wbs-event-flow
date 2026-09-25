import { Button, Chip, Link, Stack, Typography } from "@mui/material";
import { formatEventTime } from "@/features/events/format-event-time";
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
      publishedAt: true,
    },
  });

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        My events
      </Typography>
      <Button
        href="/dashboard/events/new"
        variant="contained"
        sx={{ alignSelf: "flex-start" }}
      >
        Create event
      </Button>
      {events.length === 0 ? (
        <Typography color="text.secondary">
          You don’t have any events yet.
        </Typography>
      ) : (
        <Stack
          component="ul"
          spacing={3}
          sx={{ listStyle: "none", p: 0, m: 0 }}
        >
          {events.map((event) => (
            <Stack component="li" spacing={1} key={event.id}>
              <Link
                href={`/dashboard/events/${event.id}`}
                variant="h6"
                sx={{ overflowWrap: "anywhere" }}
              >
                {event.title}
              </Link>
              <Typography>
                {formatEventTime(event.startsAt, event.timezone)} (
                {event.timezone})
              </Typography>
              <Chip
                label={event.publishedAt ? "Published" : "Draft"}
                size="small"
                sx={{ alignSelf: "flex-start" }}
              />
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
