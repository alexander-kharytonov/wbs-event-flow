import { Alert, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EventGuestView } from "@/features/events/components/event-guest-view";
import { EventHeader } from "@/features/events/components/event-header";
import { RegistrationFormPreview } from "@/features/events/components/registration-form-preview";
import {
  buildEventSnapshot,
  workspaceInclude,
} from "@/features/events/server/build-event-snapshot";
import { requireEventPermission } from "@/features/events/server/require-event-permission";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireEventPermission(id, "event.preview");
  const organizer = await requireOrganizer();

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const event = await prisma.$transaction(
    async (tx) => {
      const event = await tx.event.findFirst({
        where: { id, organizerId: organizer.id },
        include: {
          ...workspaceInclude,
          _count: {
            select: {
              applications: true,
              revisions: true,
            },
          },
        },
      });

      if (!event) {
        return null;
      }

      const attendeeCount = await tx.attendee.count({
        where: { registration: { eventId: id }, revokedAt: null },
      });

      return { ...event, attendeeCount };
    },
    { isolationLevel: "RepeatableRead" },
  );

  if (!event?.registrationForm) {
    notFound();
  }

  const snapshot = buildEventSnapshot(event);

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="preview" />
      <Alert severity="info">
        Preview of your current workspace, including unpublished changes.
        Registration is unavailable in preview.
      </Alert>
      {snapshot.success ? (
        <EventGuestView snapshot={snapshot.data} now={new Date()}>
          <Stack spacing={3}>
            <Stack spacing={0.5}>
              <Typography
                variant="h6"
                component="h2"
                sx={{ minHeight: 42, display: "flex", alignItems: "center" }}
              >
                Registration form preview
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This is the form guests will complete. Fields are read-only in
                preview.
              </Typography>
            </Stack>
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
