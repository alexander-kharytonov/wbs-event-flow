import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DateTime } from "@/components/ui/date-time";
import { EventHeader } from "@/features/events/components/event-header";
import { formatEventTime } from "@/features/events/format-event-time";
import { hasEventPermission } from "@/features/events/server/event-access";
import { requireEventPermission } from "@/features/events/server/require-event-permission";
import { prisma } from "@/lib/prisma";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const { id } = await params;
  const accessChanged = (await searchParams).access === "changed";

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const access = await requireEventPermission(id, "event.context.read");

  if (!hasEventPermission(access.role, "event.edit")) {
    const event = await prisma.event.findUniqueOrThrow({
      where: { id },
      select: { cancelledAt: true, description: true },
    });

    return (
      <Stack spacing={3}>
        {accessChanged && (
          <Alert severity="info">Your access to this event has changed.</Alert>
        )}
        <EventHeader eventId={id} active="overview" />
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <Typography
              variant="h6"
              component="h2"
              sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
            >
              Event operations
            </Typography>
            <Typography color="text.secondary">
              View admitted attendees and manage check-in. Check-in follows the
              event schedule shown above.
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", gap: 1 }}
            >
              {hasEventPermission(access.role, "applications.read") && (
                <Button
                  href={`/dashboard/events/${id}/applications`}
                  variant="outlined"
                >
                  Review applications
                </Button>
              )}
              <Button
                href={`/dashboard/events/${id}/attendees`}
                variant="outlined"
              >
                View attendees
              </Button>
              <Button
                href={`/dashboard/events/${id}/check-in`}
                variant="contained"
              >
                Open check-in
              </Button>
            </Stack>
            {event.cancelledAt && (
              <Typography color="text.secondary">
                New check-ins are unavailable.
              </Typography>
            )}
            {event.description && (
              <Stack
                component="section"
                spacing={2}
                sx={{ pt: 3, borderTop: 1, borderColor: "divider" }}
              >
                <Typography
                  variant="h6"
                  component="h2"
                  sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
                >
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
          </Stack>
        </Paper>
      </Stack>
    );
  }

  const event = await prisma.event.findFirst({
    where: { id },
    include: {
      _count: {
        select: {
          applications: true,
          revisions: true,
        },
      },
      publishedRevision: {
        select: { contentVersion: true, number: true, snapshot: true },
      },
    },
  });

  if (!event) {
    notFound();
  }

  return (
    <Stack spacing={3}>
      {accessChanged && (
        <Alert severity="info">Your access to this event has changed.</Alert>
      )}
      <EventHeader eventId={id} active="overview" />
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 4,
          }}
        >
          <Stack component="section" spacing={2}>
            <Typography
              variant="h6"
              component="h2"
              sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
            >
              Schedule
            </Typography>
            <DateTime
              date={event.startsAt}
              endDate={event.endsAt}
              timezone={event.timezone}
            />
          </Stack>
          <Stack component="section" spacing={2}>
            <Typography
              variant="h6"
              component="h2"
              sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
            >
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
              Event capacity: {event.capacity ?? "No limit"}
            </Typography>
          </Stack>
          <Stack component="section" spacing={2}>
            <Typography
              variant="h6"
              component="h2"
              sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
            >
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
                Applicant account{" "}
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
            <Typography
              variant="h6"
              component="h2"
              sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
            >
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
              <Typography
                variant="h6"
                component="h2"
                sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
              >
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
