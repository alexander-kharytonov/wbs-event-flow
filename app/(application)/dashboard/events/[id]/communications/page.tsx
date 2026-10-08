import { Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { audienceLabel } from "@/features/communications/audiences";
import {
  ComposeMessage,
  RefreshCommunicationHistory,
} from "@/features/communications/components/compose-message";
import { deliveryStatusMeaning } from "@/features/communications/server/history";
import { readCommunicationHistory } from "@/features/communications/server/read-history";
import { EventHeader } from "@/features/events/components/event-header";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export default async function CommunicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ before?: string }>;
}) {
  const user = await requireVerifiedUser();
  const { id } = await params;
  const { before } = await searchParams;
  const data = await prisma.$transaction(
    (tx) => readCommunicationHistory(tx, id, user.id, before),
    { isolationLevel: "RepeatableRead", timeout: 15_000 },
  );

  if (!data?.header) {
    notFound();
  }

  const disabledReason = data.eligibility.allowed
    ? undefined
    : data.eligibility.reason === "ARCHIVED"
      ? "Restore this event before sending a message."
      : "Publish this event before sending a message.";
  const dateFormat = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: data.header.context.timezone,
  });
  const base = `/dashboard/events/${id}/communications`;

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="communications" data={data.header} />
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
            History
          </Typography>
          <RefreshCommunicationHistory />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Sent means accepted by the mail transport, not confirmed mailbox
          delivery. Status counts update when History is refreshed.
        </Typography>
        {data.items.length === 0 && (
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography>No communications yet.</Typography>
            <Typography variant="body2" color="text.secondary">
              Messages queued for this event will appear here.
            </Typography>
          </Paper>
        )}
        {data.items.map((item) => (
          <Paper key={item.id} variant="outlined" sx={{ p: 2.5 }}>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
              >
                <Chip
                  size="small"
                  label={item.kind === "MANUAL" ? "Manual" : "Transactional"}
                  variant="outlined"
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="time"
                  dateTime={item.createdAt.toISOString()}
                >
                  {dateFormat.format(item.createdAt)} ·{" "}
                  {data.header?.context.timezone}
                </Typography>
              </Stack>
              <Typography
                variant="subtitle1"
                component="h3"
                sx={{ fontWeight: 600, overflowWrap: "anywhere" }}
              >
                {item.subject}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {item.audience
                  ? audienceLabel(item.audience)
                  : item.trigger?.replaceAll("_", " ").toLowerCase()}{" "}
                · {item.recipientCount} recipients
              </Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                {(["PENDING", "PROCESSING", "SENT", "FAILED"] as const).map(
                  (status) => (
                    <Chip
                      key={status}
                      size="small"
                      variant="outlined"
                      title={deliveryStatusMeaning[status]}
                      color={
                        status === "FAILED" && item.deliveryCounts[status]
                          ? "error"
                          : "default"
                      }
                      label={`${status.charAt(0)}${status.slice(1).toLowerCase()}: ${item.deliveryCounts[status]}`}
                    />
                  ),
                )}
              </Stack>
            </Stack>
          </Paper>
        ))}
        <Stack direction="row" spacing={1}>
          {data.hasCursor && (
            <Button href={`${base}#communication-history`}>
              Latest messages
            </Button>
          )}
          {data.nextCursor && (
            <Button
              href={`${base}?before=${data.nextCursor}#communication-history`}
            >
              Older messages
            </Button>
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}
