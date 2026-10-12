import { Stack } from "@mui/material";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/ui/section-header";
import { ApplicationsList } from "@/features/events/components/applications-list";
import { EventHeader } from "@/features/events/components/event-header";
import { EventText } from "@/features/events/components/event-text";
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

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="applications">
        <SectionHeader
          title={<EventText id="applications" />}
          description={<EventText id="applicationsDescription" />}
        />
        <ApplicationsList
          eventId={id}
          applications={event.applications}
          timezone={event.timezone}
        />
      </EventHeader>
    </Stack>
  );
}
