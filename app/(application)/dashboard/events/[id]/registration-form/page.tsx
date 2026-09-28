import { Alert, Button, Stack } from "@mui/material";
import { notFound } from "next/navigation";
import { EventHeader } from "@/features/events/components/event-header";
import { RegistrationFormBuilder } from "@/features/events/components/registration-form-builder";
import { workspaceReadOnly } from "@/features/events/event-lifecycle";
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
      {workspaceReadOnly(event, new Date()) ? (
        <Alert
          severity="info"
          sx={{ alignItems: "center", "& .MuiAlert-action": { py: 0 } }}
          action={
            <Button href={`/dashboard/events/${id}/preview`} size="small">
              View form
            </Button>
          }
        >
          This registration form is read-only.
        </Alert>
      ) : (
        <RegistrationFormBuilder
          key={id}
          eventId={id}
          initialForm={event.form}
        />
      )}
    </Stack>
  );
}
