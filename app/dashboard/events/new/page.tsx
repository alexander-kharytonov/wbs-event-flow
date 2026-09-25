import { Link, Stack, Typography } from "@mui/material";
import { createEvent } from "@/features/events/create-event";
import { EventForm } from "@/features/events/event-form";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

export default async function NewEventPage() {
  await requireOrganizer();

  return (
    <Stack spacing={3}>
      <Link href="/dashboard" sx={{ alignSelf: "flex-start" }}>
        My events
      </Link>
      <Typography variant="h4" component="h1">
        Create event
      </Typography>
      <Typography color="text.secondary">
        Your event will be saved as a draft.
      </Typography>
      <EventForm serverAction={createEvent} />
    </Stack>
  );
}
