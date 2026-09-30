import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DateTime } from "@/components/ui/date-time";
import { EventHeader } from "@/features/events/components/event-header";
import { eventLifecycle } from "@/features/events/event-lifecycle";
import { formatEventTime } from "@/features/events/format-event-time";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const event = await prisma.event.findFirst({
    where: { id, organizerId: organizer.id },
    include: {
      _count: {
        select: {
          applications: true,
          revisions: true,
        },
      },
      publishedRevision: { select: { contentVersion: true, number: true } },
    },
  });

  if (!event) {
    notFound();
  }

  const attendeeCount = await prisma.attendee.count({
    where: { registration: { eventId: id }, revokedAt: null },
  });

  const lifecycle = eventLifecycle(event, new Date());
  const actions: ("cancel" | "unpublish" | "archive" | "restore" | "delete")[] =
    [];

  if (event.archivedAt) {
    actions.push("restore");
  } else {
    if (!event.cancelledAt && event.publishedRevisionId) {
      actions.push("unpublish");
    }

    if (lifecycle === "Cancelled" || lifecycle === "Completed") {
      actions.push("archive");
    }

    if (
      !event.cancelledAt &&
      lifecycle !== "Completed" &&
      event._count.revisions > 0
    ) {
      actions.push("cancel");
    }

    if (
      !event.cancelledAt &&
      !event.publicId &&
      !event.publishedAt &&
      event._count.revisions === 0 &&
      event._count.applications === 0
    ) {
      actions.push("delete");
    }
  }

  return (
    <Stack spacing={3}>
      <EventHeader
        eventId={id}
        event={event}
        actions={actions}
        active="overview"
        applicationCount={event._count.applications}
        attendeeCount={attendeeCount}
      />
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 4,
          }}
        >
          <Stack component="section" spacing={2}>
            <Typography variant="h6" component="h2">
              Schedule
            </Typography>
            <DateTime
              date={event.startsAt}
              endDate={event.endsAt}
              timezone={event.timezone}
            />
          </Stack>
          <Stack component="section" spacing={2}>
            <Typography variant="h6" component="h2">
              Registration
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  sm: "repeat(2, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Opens
                </Typography>
                <Typography>
                  {event.registrationOpensAt
                    ? formatEventTime(event.registrationOpensAt, event.timezone)
                    : "Not set"}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Closes
                </Typography>
                <Typography>
                  {event.registrationClosesAt
                    ? formatEventTime(
                        event.registrationClosesAt,
                        event.timezone,
                      )
                    : "Not set"}
                </Typography>
              </Box>
            </Box>
            <Typography>
              Guest capacity: {event.capacity ?? "No limit"}
            </Typography>
          </Stack>
          <Stack component="section" spacing={2}>
            <Typography variant="h6" component="h2">
              Access
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ alignItems: "flex-start" }}
            >
              <Chip
                label={event.visibility === "PRIVATE" ? "Private" : "Public"}
                size="small"
              />
              <Typography>
                Guest account{" "}
                {event.accountRequirement === "OPTIONAL"
                  ? "optional"
                  : "required"}
              </Typography>
            </Stack>
          </Stack>
          <Stack
            component="section"
            spacing={1}
            sx={{ alignItems: "flex-start" }}
          >
            <Typography variant="h6" component="h2">
              Applications
            </Typography>
            <Typography color="text.secondary">
              {event._count.applications} submitted attempts
            </Typography>
            <Button
              href={`/dashboard/events/${id}/applications`}
              variant="outlined"
            >
              Review applications
            </Button>
          </Stack>
          {event.description && (
            <Stack
              component="section"
              spacing={2}
              sx={{
                gridColumn: "1 / -1",
                pt: 3,
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <Typography variant="h6" component="h2">
                Description
              </Typography>
              <Typography
                sx={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  maxWidth: "75ch",
                }}
              >
                {event.description}
              </Typography>
            </Stack>
          )}
        </Box>
      </Paper>
    </Stack>
  );
}
