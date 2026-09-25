import { Link, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { EventForm } from "@/features/events/event-form";
import { eventFormValues } from "@/features/events/event-form-values";
import { updateEvent } from "@/features/events/update-event";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";
import { prisma } from "@/lib/prisma";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;
  const event = await prisma.event.findFirst({
    where: { id, organizerId: organizer.id },
  });

  if (!event) {
    notFound();
  }

  return (
    <Stack spacing={3}>
      <Link href={`/dashboard/events/${id}`} sx={{ alignSelf: "flex-start" }}>
        Back to event
      </Link>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1">
          Edit event
        </Typography>
        <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
          {event.title}
        </Typography>
      </Stack>
      <EventForm
        initialValues={eventFormValues(event)}
        serverAction={updateEvent}
        edit={{
          id: event.id,
          version: Buffer.from(event.updatedAt.toISOString()).toString(
            "base64url",
          ),
        }}
      />
    </Stack>
  );
}
