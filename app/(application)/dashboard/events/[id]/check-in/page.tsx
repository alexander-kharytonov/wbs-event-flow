import { Alert, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketScanner } from "@/features/attendance/components/ticket-scanner";
import { EventHeader } from "@/features/events/components/event-header";
import { eventLifecycle } from "@/features/events/event-lifecycle";
import { formatEventTime } from "@/features/events/format-event-time";
import { getEventAttendees } from "@/features/events/server/organizer-attendees";
import { requireVerifiedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Check-in | Event Flow" };

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireVerifiedUser();
  const { id } = await params;
  const data = await getEventAttendees(user.id, id);

  if (!data) {
    notFound();
  }

  const { event } = data;
  const attendees: import("@/features/events/server/organizer-attendees").OrganizerAttendee[] =
    data.attendees;
  const active = attendees.filter(
    (attendee) => !attendee.revokedAt && !attendee.registration.revokedAt,
  );
  const checkedIn = active.filter(
    (attendee) => attendee.attendance !== null,
  ).length;
  const lifecycle = eventLifecycle(event, new Date());

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="check-in" />
      {lifecycle === "Ongoing" && (
        <Alert severity="info">
          Start the scanner to scan an attendee’s ticket QR. The camera stays on
          between scans. Choose Scan next when you’re ready for the next ticket.
        </Alert>
      )}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          gap: 1,
          justifyContent: "space-between",
          alignItems: { sm: "center" },
        }}
      >
        <Typography
          variant="h6"
          component="h2"
          sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
        >
          Check-in
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {checkedIn} checked in · {active.length} active attendees
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
