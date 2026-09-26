import { Alert, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { EventGuestView } from "@/features/events/components/event-guest-view";
import { EventHeader } from "@/features/events/components/event-header";
import { RegistrationFormPreview } from "@/features/events/components/registration-form-preview";
import {
  buildEventSnapshot,
  workspaceInclude,
} from "@/features/events/server/build-event-snapshot";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;
  const event = await prisma.$transaction(
    (tx) =>
      tx.event.findFirst({
        where: { id, organizerId: organizer.id },
        include: {
          ...workspaceInclude,
          _count: { select: { applications: true } },
        },
      }),
    { isolationLevel: "RepeatableRead" },
  );

  if (!event?.registrationForm) {
    notFound();
  }

  const snapshot = buildEventSnapshot(event);

  return (
    <Stack spacing={3}>
      <EventHeader
        eventId={id}
        event={event}
        active="preview"
        applicationCount={event._count.applications}
      />
      <Alert severity="info">
        Preview of your current workspace, including unpublished changes.
        Registration is unavailable in preview.
      </Alert>
      {snapshot.success ? (
        <EventGuestView snapshot={snapshot.data} now={new Date()}>
          <Stack spacing={3}>
            <Typography variant="h6" component="h2">
              Registration form preview
            </Typography>
            <RegistrationFormPreview
              fields={snapshot.data.registrationForm.fields}
            />
          </Stack>
        </EventGuestView>
      ) : (
        <Alert severity="error">
          Check the event details and registration questions before previewing.
        </Alert>
      )}
    </Stack>
  );
}
