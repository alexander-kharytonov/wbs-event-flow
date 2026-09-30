import { Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { ApplicationRealtime } from "@/features/events/components/application-realtime";
import { ApplicationsList } from "@/features/events/components/applications-list";
import { EventHeader } from "@/features/events/components/event-header";
import { getOwnedApplications } from "@/features/events/server/organizer-applications";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

export default async function ApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;
  const { status } = await searchParams;
  const event = await getOwnedApplications(organizer.id, id);

  if (!event) {
    notFound();
  }

  const filter =
    status === "PENDING" ||
    status === "APPROVED" ||
    status === "REJECTED" ||
    status === "WITHDRAWN"
      ? status
      : "ALL";
  const pendingCount = event.applications.filter(
    (application) => application.status === "PENDING",
  ).length;

  return (
    <Stack spacing={3}>
      <ApplicationRealtime
        streamUrl={`/api/events/${id}/applications/stream`}
      />
      <EventHeader
        eventId={id}
        event={event}
        active="applications"
        applicationCount={event.applications.length}
        attendeeCount={event.occupied}
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
          Applications
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {pendingCount} pending review · {event.applications.length} submitted
          attempts
        </Typography>
      </Stack>
      <ApplicationsList
        key={filter}
        eventId={id}
        applications={event.applications}
        timezone={event.timezone}
        initialStatus={filter}
      />
    </Stack>
  );
}
