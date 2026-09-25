import { Link, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { EventNavigation } from "@/features/events/components/event-navigation";
import { PublicationControls } from "@/features/events/components/publication-controls";
import { RegistrationFormBuilder } from "@/features/events/components/registration-form-builder";
import { getRegistrationForm } from "@/features/events/server/registration-form";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

export default async function RegistrationFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;
  const event = await getRegistrationForm(id, organizer.id);

  if (!event) {
    notFound();
  }

  return (
    <Stack spacing={3}>
      <Link href="/dashboard" sx={{ alignSelf: "flex-start" }}>
        My events
      </Link>
      <Stack spacing={1.5}>
        <Typography
          variant="h4"
          component="h1"
          sx={{ overflowWrap: "anywhere" }}
        >
          {event.title}
        </Typography>
        <PublicationControls
          eventId={id}
          contentVersion={event.contentVersion}
          publishedRevision={event.publishedRevision}
          publicId={event.publicId}
        />
      </Stack>
      <EventNavigation eventId={id} active="registration-form" />
      <Stack spacing={0.5}>
        <Typography variant="h5" component="h2">
          Registration form
        </Typography>
        <Typography color="text.secondary">
          Manage the questions guests will see when registering.
        </Typography>
      </Stack>
      <RegistrationFormBuilder key={id} eventId={id} initialForm={event.form} />
    </Stack>
  );
}
