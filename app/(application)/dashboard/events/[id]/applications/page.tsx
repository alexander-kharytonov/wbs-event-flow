import { Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { ApplicationsList } from "@/features/events/components/applications-list";
import { EventHeader } from "@/features/events/components/event-header";
import { getEventApplications } from "@/features/events/server/organizer-applications";
import { requireVerifiedUser } from "@/lib/session";

export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireVerifiedUser();
  const { id } = await params;
  const event = await getEventApplications(user.id, id);

  if (!event) {
    notFound();
  }

  const pendingCount = event.applications.filter(
    (application) => application.status === "PENDING",
  ).length;

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="applications">
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
            Applications
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pendingCount} pending review · {event.applications.length}{" "}
            submitted attempts
          </Typography>
        </Stack>
        <ApplicationsList
          eventId={id}
          applications={event.applications}
          timezone={event.timezone}
        />
      </EventHeader>
    </Stack>
  );
}
