import { Alert, Stack } from "@mui/material";
import { notFound } from "next/navigation";
import { EventHeader } from "@/features/events/components/event-header";
import { EventOverviewContent } from "@/features/events/components/event-overview";
import { OverviewBoundaryRefresh } from "@/features/events/components/overview-boundary-refresh";
import { getEventOverview } from "@/features/events/server/event-overview";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const { id } = await params;
  const data = await getEventOverview(id);

  if (!data) {
    notFound();
  }

  const boundary =
    data.lifecycle === "Upcoming"
      ? data.header.context.startsAt
      : data.lifecycle === "Ongoing"
        ? data.header.context.endsAt
        : null;

  return (
    <Stack spacing={3}>
      {(await searchParams).access === "changed" && (
        <Alert severity="info">Your access to this event has changed.</Alert>
      )}
      <OverviewBoundaryRefresh
        key={id}
        boundaryAt={boundary?.toISOString() ?? null}
      />
      <EventHeader
        eventId={id}
        active="overview"
        data={data.header}
        now={data.now}
      />
      <EventOverviewContent data={data} />
    </Stack>
  );
}
