import { Stack } from "@mui/material";
import { notFound } from "next/navigation";
import { CommunicationHistory } from "@/features/communications/components/communication-history";
import { CommunicationsWorkspace } from "@/features/communications/components/communications-workspace";
import { readCommunicationHistory } from "@/features/communications/server/read";
import { EventHeader } from "@/features/events/components/event-header";

export default async function CommunicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ before?: string }>;
}) {
  const { id } = await params;
  const { before } = await searchParams;
  const data = await readCommunicationHistory(id, before, { kind: "MANUAL" });

  if (!data?.header) {
    notFound();
  }

  const disabledReason = data.eligibility.allowed
    ? undefined
    : data.eligibility.reason === "ARCHIVED"
      ? "commRestore"
      : "commPublish";

  return (
    <Stack spacing={3}>
      <EventHeader
        eventId={id}
        active="communications"
        data={data.header}
        contentPadding={false}
      >
        <CommunicationsWorkspace
          eventId={id}
          disabledReason={disabledReason}
          initialHistory={before !== undefined}
          history={
            <CommunicationHistory
              eventId={id}
              timezone={data.header.context.timezone}
              initialBefore={before}
              initialData={{
                items: data.items,
                hasCursor: data.hasCursor,
                nextCursor: data.nextCursor,
              }}
            />
          }
        />
      </EventHeader>
    </Stack>
  );
}
