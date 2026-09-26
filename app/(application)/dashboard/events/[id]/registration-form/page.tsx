import { Alert, Stack } from "@mui/material";
import { notFound } from "next/navigation";
import { EventHeader } from "@/features/events/components/event-header";
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
      <EventHeader
        eventId={id}
        event={event}
        active="registration-form"
        applicationCount={event.applicationCount}
      />
      <Alert severity="info">
        Manage the questions guests will see when registering.
      </Alert>
      <RegistrationFormBuilder key={id} eventId={id} initialForm={event.form} />
    </Stack>
  );
}
