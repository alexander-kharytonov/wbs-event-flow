import { Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationRealtime } from "@/features/events/components/application-realtime";
import { AttendeesList } from "@/features/events/components/attendees-list";
import { EventHeader } from "@/features/events/components/event-header";
import { eventLifecycle } from "@/features/events/event-lifecycle";
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
  const activeAttendees = attendees.filter(
    (attendee) => !attendee.revokedAt && !attendee.registration.revokedAt,
  );
  const activeCount = activeAttendees.length;
  const checkedInCount = activeAttendees.filter(
    (attendee) => attendee.attendance,
  ).length;
  const admission =
    status === "active" || status === "revoked" ? status : "all";

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
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          gap: 1,
          justifyContent: "space-between",
          alignItems: { sm: "baseline" },
        }}
      >
        <Typography variant="h6" component="h2">
          Attendees
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {activeCount} admitted · {checkedInCount} checked in ·{" "}
          {activeCount - checkedInCount} not arrived
        </Typography>
      </Stack>
      <AttendeesList
        key={admission}
        eventId={id}
        attendees={attendees}
        timezone={event.timezone}
        lifecycle={eventLifecycle(event, new Date())}
        initialAdmission={admission}
      />
    </Stack>
  );
}
