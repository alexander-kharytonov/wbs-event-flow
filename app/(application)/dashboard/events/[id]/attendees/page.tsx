import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { ApplicationRealtime } from "@/features/events/components/application-realtime";
import { EventHeader } from "@/features/events/components/event-header";
import { formatEventTime } from "@/features/events/format-event-time";
import { getOwnedAttendees } from "@/features/events/server/organizer-attendees";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

export const metadata: Metadata = { title: "Attendees | Event Flow" };

export default async function AttendeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;
  const { status } = await searchParams;
  const data = await getOwnedAttendees(organizer.id, id);

  if (!data) {
    notFound();
  }

  const { event, attendees } = data;
  const revoked = status === "revoked";
  const activeCount = attendees.filter(
    (attendee) => attendee.revokedAt === null,
  ).length;
  const visible = attendees.filter(
    (attendee) => (attendee.revokedAt !== null) === revoked,
  );
  const checkedInCount = attendees.filter(
    (attendee) => attendee.revokedAt === null && attendee.attendance !== null,
  ).length;

  return (
    <Stack spacing={3}>
      <ApplicationRealtime
        streamUrl={`/api/events/${id}/applications/stream`}
      />
      <EventHeader
        eventId={id}
        event={event}
        active="attendees"
        applicationCount={event._count.applications}
        attendeeCount={activeCount}
      />
      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          Attendees
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Granted registrations and their history. Pending requests remain in
          Applications.
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Checked in: {checkedInCount} / {activeCount} active registrations
        </Typography>
      </Stack>
      <Stack
        component="nav"
        aria-label="Filter attendees"
        direction="row"
        spacing={1}
      >
        <Button
          href={`/dashboard/events/${id}/attendees`}
          variant={!revoked ? "contained" : "text"}
          aria-current={!revoked ? "page" : undefined}
        >
          Active ({activeCount})
        </Button>
        <Button
          href={`/dashboard/events/${id}/attendees?status=revoked`}
          variant={revoked ? "contained" : "text"}
          aria-current={revoked ? "page" : undefined}
        >
          Revoked ({attendees.length - activeCount})
        </Button>
      </Stack>
      {visible.length === 0 ? (
        <EmptyState
          icon={<PeopleOutlined />}
          title={
            revoked ? "No revoked registrations" : "No active attendees yet"
          }
          description={
            revoked
              ? "Withdrawn admissions will appear here."
              : "Attendees appear when you approve an application."
          }
        />
      ) : (
        <Paper
          variant="outlined"
          component="ul"
          sx={{ m: 0, p: 0, listStyle: "none" }}
        >
          {visible.map((attendee) => (
            <Box
              key={attendee.id}
              component="li"
              sx={{
                p: { xs: 2, sm: 3 },
                "& + li": { borderTop: 1, borderColor: "divider" },
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{
                  gap: 2,
                  justifyContent: "space-between",
                  overflowWrap: "anywhere",
                }}
              >
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    {attendee.attendeeName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {attendee.attendeeEmail}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Granted{" "}
                    {formatEventTime(attendee.createdAt, event.timezone)} (
                    {event.timezone})
                  </Typography>
                  {attendee.revokedAt && (
                    <Typography variant="body2" color="text.secondary">
                      Revoked{" "}
                      {formatEventTime(attendee.revokedAt, event.timezone)} (
                      {event.timezone})
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {attendee.attendance
                      ? `Checked in · ${formatEventTime(attendee.attendance.checkedInAt, event.timezone)} (${event.timezone})`
                      : "Not checked in"}
                  </Typography>
                </Stack>
                <Chip
                  size="small"
                  variant="outlined"
                  label={attendee.revokedAt ? "Revoked" : "Active"}
                  color={attendee.revokedAt ? "default" : "success"}
                  sx={{ alignSelf: "flex-start" }}
                />
              </Stack>
            </Box>
          ))}
        </Paper>
      )}
    </Stack>
  );
}
