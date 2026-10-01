import { Alert, Stack } from "@mui/material";
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
        <Alert severity="info">Your access to this event has changed.</Alert>
      )}
      <OrganizerEventList />
    </Stack>
  );
}
