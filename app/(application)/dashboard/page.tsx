import { Alert, Stack } from "@mui/material";
import { EventText } from "@/features/events/components/event-text";
import { OrganizerEventList } from "@/features/events/components/organizer-event-list";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string }>;
}) {
  const changed = (await searchParams).access === "changed";

  return (
    <Stack spacing={3}>
      {changed && (
        <Alert severity="info">
          <EventText id="accessChanged" />
        </Alert>
      )}
      <OrganizerEventList />
    </Stack>
  );
}
