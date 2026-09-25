import { Alert, Link, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { EventGuestView } from "@/features/events/components/event-guest-view";
import { EventNavigation } from "@/features/events/components/event-navigation";
import { PublicationControls } from "@/features/events/components/publication-controls";
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
        include: workspaceInclude,
      }),
    { isolationLevel: "RepeatableRead" },
  );

  if (!event?.registrationForm) {
    notFound();
  }

  const snapshot = buildEventSnapshot(event);

  return (
    <Stack spacing={3}>
      <Link href="/dashboard" sx={{ alignSelf: "flex-start" }}>
        My events
      </Link>
      <Typography variant="h4" component="h2">
        Event preview
      </Typography>
      <PublicationControls
        eventId={id}
        contentVersion={event.contentVersion}
        publishedRevision={event.publishedRevision}
        publicId={event.publicId}
      />
      <EventNavigation eventId={id} active="preview" />
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
