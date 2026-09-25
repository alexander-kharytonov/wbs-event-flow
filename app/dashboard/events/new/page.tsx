import { Link, Stack, Typography } from "@mui/material";
import { CreateEventForm } from "@/features/events/create-event-form";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

export default async function NewEventPage() {
  await requireOrganizer();

  return (
    <Stack spacing={3}>
      <Link href="/dashboard">My events</Link>
      <Typography variant="h4" component="h1">
        Create event
      </Typography>
      <Typography color="text.secondary">
        Your event will be saved as a draft.
      </Typography>
      <CreateEventForm />
    </Stack>
  );
}
