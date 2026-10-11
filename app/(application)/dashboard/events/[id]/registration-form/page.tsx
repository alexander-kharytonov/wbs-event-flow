import { Alert, Button, Stack } from "@mui/material";
import { notFound } from "next/navigation";
import { EventHeader } from "@/features/events/components/event-header";
import { EventText } from "@/features/events/components/event-text";
import { RegistrationFormBuilder } from "@/features/events/components/registration-form-builder";
import { workspaceReadOnly } from "@/features/events/event-lifecycle";
import { getRegistrationForm } from "@/features/events/server/registration-form";
import { requireEventPermission } from "@/features/events/server/require-event-permission";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

export default async function RegistrationFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireEventPermission(id, "registrationForm.edit");
  const organizer = await requireOrganizer();
  const event = await getRegistrationForm(id, organizer.id);

  if (!event) {
    notFound();
  }

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="registration-form">
        {workspaceReadOnly(event, new Date()) ? (
          <Alert
            severity="info"
            sx={{ alignItems: "center", "& .MuiAlert-action": { py: 0 } }}
            action={
              <Button href={`/dashboard/events/${id}/preview`} size="small">
                <EventText id="viewForm" />
              </Button>
            }
          >
            <EventText id="formReadOnly" />
          </Alert>
        ) : (
          <RegistrationFormBuilder
            key={id}
            eventId={id}
            initialForm={event.form}
          />
        )}
      </EventHeader>
    </Stack>
  );
}
