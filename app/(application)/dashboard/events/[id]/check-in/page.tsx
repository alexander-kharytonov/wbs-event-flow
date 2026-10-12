import { Alert, Stack } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SectionHeader } from "@/components/ui/section-header";
import { CheckInWindow } from "@/features/attendance/components/check-in-feedback";
import { TicketScanner } from "@/features/attendance/components/ticket-scanner";
import { EventHeader } from "@/features/events/components/event-header";
import { EventText } from "@/features/events/components/event-text";
import { eventLifecycle } from "@/features/events/event-lifecycle";
import { getEventAttendees } from "@/features/events/server/organizer-attendees";
import { requireVerifiedUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("events");

  return { title: `${t("checkIn")} | Event Flow` };
}

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
  const lifecycle = eventLifecycle(event, new Date());

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="check-in">
        <SectionHeader
          title={<EventText id="checkIn" />}
          description={<EventText id="scannerInstructions" />}
        />
        {lifecycle === "Ongoing" ? (
          <TicketScanner eventId={id} timezone={event.timezone} />
        ) : (
          <Alert severity={lifecycle === "Cancelled" ? "error" : "info"}>
            {lifecycle === "Cancelled" ? (
              <EventText id="scannerCancelled" />
            ) : lifecycle === "Upcoming" ? (
              <CheckInWindow
                opens
                date={event.startsAt}
                timezone={event.timezone}
              />
            ) : (
              <CheckInWindow
                opens={false}
                date={event.endsAt}
                timezone={event.timezone}
              />
            )}
          </Alert>
        )}
      </EventHeader>
    </Stack>
  );
}
