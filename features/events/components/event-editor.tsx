import { Alert, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/ui/back-link";
import { EventFormDialog } from "@/features/events/components/event-form-dialog";
import { EventForm } from "@/features/events/event-form";
import {
  eventDateSource,
  eventFormValues,
} from "@/features/events/event-form-values";
import {
  eventLifecycle,
  workspaceReadOnly,
} from "@/features/events/event-lifecycle";
import { CreateEventModes } from "@/features/events/import/create-event-modes";
import { requireEventPermission } from "@/features/events/server/require-event-permission";
import { updateEvent } from "@/features/events/update-event";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export async function CreateEventView({ modal = false }: { modal?: boolean }) {
  await requireOrganizer();

  const content = (
    <Stack spacing={3} sx={{ width: "100%" }}>
      {!modal && <BackLink href="/dashboard">My events</BackLink>}
      {!modal && (
        <Typography variant="h4" component="h1">
          Create event
        </Typography>
      )}
      <CreateEventModes />
    </Stack>
  );

  return modal ? (
    <EventFormDialog title="Create event">{content}</EventFormDialog>
  ) : (
    content
  );
}

export async function EditEventView({
  eventId: id,
  modal = false,
}: {
  eventId: string;
  modal?: boolean;
}) {
  await requireEventPermission(id, "event.edit");
  const organizer = await requireOrganizer();

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const event = await prisma.event.findFirst({
    where: { id, organizerId: organizer.id },
  });

  if (!event) {
    notFound();
  }

  const content = (
    <Stack spacing={3} sx={{ width: "100%" }}>
      {!modal && (
        <BackLink href={`/dashboard/events/${id}`}>Back to event</BackLink>
      )}
      {!modal && (
        <Typography
          variant="h4"
          component="h1"
          sx={{ overflowWrap: "anywhere" }}
        >
          {event.title}
        </Typography>
      )}
      {workspaceReadOnly(event, new Date()) ? (
        <Alert severity="info">
          This event is read-only. Its information and history remain available.
        </Alert>
      ) : (
        <EventForm
          startLocked={eventLifecycle(event, new Date()) === "Ongoing"}
          initialValues={eventFormValues(event)}
          serverAction={updateEvent}
          edit={{
            id: event.id,
            dates: eventDateSource(event),
            version: Buffer.from(event.updatedAt.toISOString()).toString(
              "base64url",
            ),
          }}
        />
      )}
    </Stack>
  );

  return modal ? (
    <EventFormDialog title={event.title}>{content}</EventFormDialog>
  ) : (
    content
  );
}
