import { Alert, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketScanner } from "@/features/attendance/components/ticket-scanner";
import { ApplicationRealtime } from "@/features/events/components/application-realtime";
import { EventHeader } from "@/features/events/components/event-header";
import { eventLifecycle } from "@/features/events/event-lifecycle";
import { formatEventTime } from "@/features/events/format-event-time";
import { getOwnedAttendees } from "@/features/events/server/organizer-attendees";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

export const metadata: Metadata = { title: "Check-in | Event Flow" };

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;
  const data = await getOwnedAttendees(organizer.id, id);

  if (!data) {
    notFound();
  }

  const { event, attendees } = data;
  const active = attendees.filter((attendee) => attendee.revokedAt === null);
  const checkedIn = active.filter(
    (attendee) => attendee.attendance !== null,
  ).length;
  const lifecycle = eventLifecycle(event, new Date());

  return (
    <Stack spacing={3}>
      <ApplicationRealtime
        streamUrl={`/api/events/${id}/applications/stream`}
      />
      <EventHeader
        eventId={id}
        event={event}
        active="check-in"
        applicationCount={event._count.applications}
        attendeeCount={active.length}
      />
      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          Check-in
        </Typography>
        <Typography color="text.secondary">
          Checked in: {checkedIn} / {active.length} active registrations
        </Typography>
      </Stack>
      {lifecycle === "Ongoing" ? (
        <TicketScanner eventId={id} timezone={event.timezone} />
      ) : (
        <Alert severity={lifecycle === "Cancelled" ? "error" : "info"}>
          {lifecycle === "Cancelled"
            ? "This event is cancelled. New check-ins are unavailable."
            : lifecycle === "Upcoming"
              ? `Check-in opens ${formatEventTime(event.startsAt, event.timezone)} (${event.timezone}). Reload when the event starts.`
              : `Check-in closed ${formatEventTime(event.endsAt, event.timezone)} (${event.timezone}). Attendance history remains available in Attendees.`}
        </Alert>
      )}
    </Stack>
  );
}
