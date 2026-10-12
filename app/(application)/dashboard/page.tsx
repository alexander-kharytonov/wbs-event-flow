import { Alert, Stack } from "@mui/material";
import { EventText } from "@/features/events/components/event-text";
import { OrganizerDashboard } from "@/features/events/components/organizer-dashboard";
import { getOrganizerDashboard } from "@/features/events/server/organizer-dashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string }>;
}) {
  const data = await getOrganizerDashboard();
  const changed = (await searchParams).access === "changed";

  return (
    <Stack spacing={3}>
      {changed && (
        <Alert severity="info">
          <EventText id="accessChanged" />
        </Alert>
      )}
      <OrganizerDashboard data={data} />
    </Stack>
  );
}
