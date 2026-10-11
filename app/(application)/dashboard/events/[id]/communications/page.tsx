import { Alert, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { CommunicationHistory } from "@/features/communications/components/communication-history";
import {
  ComposeMessage,
  RefreshCommunicationHistory,
} from "@/features/communications/components/compose-message";
import { readCommunicationHistory } from "@/features/communications/server/read";
import { EventHeader } from "@/features/events/components/event-header";
import { EventText } from "@/features/events/components/event-text";

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
      <EventHeader eventId={id} active="communications" data={data.header}>
        <ComposeMessage eventId={id} disabledReason={disabledReason} />
        <Stack
          component="section"
          id="communication-history"
          spacing={2}
          sx={{ scrollMarginTop: 24 }}
          aria-labelledby="communication-history-title"
        >
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography
              variant="h6"
              component="h2"
              id="communication-history-title"
            >
              <EventText id="commHistory" />
            </Typography>
            <RefreshCommunicationHistory />
          </Stack>
          <Alert severity="info">
            <EventText id="commSentExplanation" />
          </Alert>
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
        </Stack>
      </EventHeader>
    </Stack>
  );
}
