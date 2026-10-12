import { Stack } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SectionHeader } from "@/components/ui/section-header";
import { AttendeesList } from "@/features/events/components/attendees-list";
import { EventHeader } from "@/features/events/components/event-header";
import { EventText } from "@/features/events/components/event-text";
import { eventLifecycle } from "@/features/events/event-lifecycle";
import { getEventAttendees } from "@/features/events/server/organizer-attendees";
import { requireVerifiedUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("events");

  return { title: `${t("attendees")} | Event Flow` };
}

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

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="attendees">
        <SectionHeader
          title={<EventText id="attendees" />}
          description={<EventText id="attendeesDescription" />}
        />
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
