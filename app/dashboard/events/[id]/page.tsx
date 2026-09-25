import EditOutlined from "@mui/icons-material/EditOutlined";
import {
  Box,
  Button,
  Chip,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { notFound } from "next/navigation";
import { formatEventTime } from "@/features/events/format-event-time";
import { formatTimezone } from "@/features/events/format-timezone";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;
  const event = await prisma.event.findFirst({
    where: { id, organizerId: organizer.id },
  });

  if (!event) {
    notFound();
  }

  return (
    <Stack spacing={3}>
      <Link href="/dashboard" sx={{ alignSelf: "flex-start" }}>
        My events
      </Link>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{ overflowWrap: "anywhere" }}
          >
            {event.title}
          </Typography>
          <Chip
            label={event.publishedAt ? "Published" : "Draft"}
            size="small"
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
          />
        </Stack>
        {!event.publishedAt && (
          <Button
            href={`/dashboard/events/${id}/edit`}
            variant="contained"
            startIcon={<EditOutlined />}
            sx={{ flexShrink: 0, alignSelf: "flex-start" }}
          >
            Edit event
          </Button>
        )}
      </Stack>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Stack spacing={3}>
          <Stack component="section" spacing={2}>
            <Typography variant="h6" component="h2">
              Schedule
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
                  Starts
                </Typography>
                <Typography>
                  {formatEventTime(event.startsAt, event.timezone)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Ends
                </Typography>
                <Typography>
                  {formatEventTime(event.endsAt, event.timezone)}
                </Typography>
              </Box>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ overflowWrap: "anywhere" }}
            >
              All times in {formatTimezone(event.timezone)}
            </Typography>
          </Stack>
          <Divider />
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
          <Divider />
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
          {event.description && (
            <>
              <Divider />
              <Stack component="section" spacing={2}>
                <Typography variant="h6" component="h2">
                  Description
                </Typography>
                <Typography
                  sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {event.description}
                </Typography>
              </Stack>
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
