import { Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttendeesList } from "@/features/events/components/attendees-list";
import { EventHeader } from "@/features/events/components/event-header";
import { eventLifecycle } from "@/features/events/event-lifecycle";
import { getEventAttendees } from "@/features/events/server/organizer-attendees";
import { requireVerifiedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Attendees | Event Flow" };

export default async function AttendeesPage({
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
  const activeAttendees = attendees.filter(
    (attendee) => !attendee.revokedAt && !attendee.registration.revokedAt,
  );
  const activeCount = activeAttendees.length;
  const checkedInCount = activeAttendees.filter(
    (attendee) => attendee.attendance,
  ).length;

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="attendees">
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
            Attendees
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {activeCount} admitted · {checkedInCount} checked in ·{" "}
            {activeCount - checkedInCount} not arrived
          </Typography>
        </Stack>
        <AttendeesList
          eventId={id}
          attendees={attendees}
          full={data.full}
          canPrintBadges={data.canPrintBadges}
          timezone={event.timezone}
          lifecycle={eventLifecycle(event, new Date())}
        />
      </EventHeader>
    </Stack>
  );
}
