import {
  Alert,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { notFound } from "next/navigation";
import { audienceLabel } from "@/features/communications/audiences";
import { RefreshCommunicationHistory } from "@/features/communications/components/compose-message";
import { DeliverySummary } from "@/features/communications/components/delivery-summary";
import { deliveryStatusMeaning } from "@/features/communications/server/history";
import { readCommunicationDetails } from "@/features/communications/server/read";
import { EventHeader } from "@/features/events/components/event-header";

export default async function CommunicationDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; communicationId: string }>;
  searchParams: Promise<{ after?: string }>;
}) {
  const { id, communicationId } = await params;
  const { after } = await searchParams;
  const data = await readCommunicationDetails(id, communicationId, after);

  if (!data?.header) {
    notFound();
  }

  const item = data.communication;
  const base = `/dashboard/events/${id}/communications`;
  const dateFormat = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: data.header.context.timezone,
  });

  return (
    <Stack spacing={3}>
      <EventHeader eventId={id} active="communications" data={data.header} />
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Button href={`${base}#communication-history`}>Back to history</Button>
        <RefreshCommunicationHistory />
      </Stack>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Chip
            size="small"
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
            label={item.kind === "MANUAL" ? "Manual" : "Transactional"}
          />
          <Typography
            variant="h5"
            component="h2"
            sx={{ overflowWrap: "anywhere" }}
          >
            {item.subject}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {item.audience
              ? audienceLabel(item.audience)
              : item.trigger?.replaceAll("_", " ").toLowerCase()}
            {" · "}
            {item.recipientCount} frozen recipients
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            component="time"
            dateTime={item.createdAt.toISOString()}
          >
            {dateFormat.format(item.createdAt)} · {data.header.context.timezone}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {item.actorNameSnapshot
              ? `${item.actorNameSnapshot} · ${item.actorRoleSnapshot}`
              : "No staff actor recorded"}
          </Typography>
          <DeliverySummary
            recipientCount={item.recipientCount}
            counts={item.deliveryCounts}
          />
          <Typography variant="body2" color="text.secondary">
            Pending: queued, awaiting an attempt. Processing: claimed by the
            dispatcher. Sent: accepted by the SMTP transport. Failed: automatic
            attempts exhausted. Sent does not confirm mailbox delivery, opening
            or reading.
          </Typography>
          <Divider />
          <Typography variant="h6" component="h3">
            {item.kind === "MANUAL" ? "Message" : "Saved context"}
          </Typography>
          {item.context.eventTitle && (
            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
              Saved event title: {item.context.eventTitle}
            </Typography>
          )}
          {item.kind === "MANUAL" ? (
            <Typography
              component="div"
              sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {item.message}
            </Typography>
          ) : (
            <Alert severity="info">
              Message content is not stored in communication history.
            </Alert>
          )}
        </Stack>
      </Paper>
      <Stack
        component="section"
        spacing={2}
        aria-labelledby="recipient-deliveries-title"
        id="recipient-deliveries"
        sx={{ scrollMarginTop: 24 }}
      >
        <Typography variant="h6" component="h3" id="recipient-deliveries-title">
          Recipient deliveries
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Frozen addresses, ordered by email · up to 50 per page. Delivery
          statuses update automatically.
        </Typography>
        {data.recipients.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography>
              {item.recipientCount === 0
                ? "No recipients were queued for this communication."
                : "No more recipients on this page."}
            </Typography>
          </Paper>
        ) : (
          <Stack
            component="ul"
            spacing={1}
            sx={{ listStyle: "none", m: 0, p: 0 }}
          >
            {data.recipients.map((recipient) => (
              <Paper
                component="li"
                key={recipient.id}
                variant="outlined"
                sx={{ p: 2 }}
              >
                <Stack spacing={1}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { xs: "flex-start", sm: "center" },
                      gap: 1,
                    }}
                  >
                    <Typography sx={{ overflowWrap: "anywhere", minWidth: 0 }}>
                      {recipient.recipientEmail}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      sx={{ flexShrink: 0 }}
                      color={
                        recipient.status === "FAILED" ? "error" : "default"
                      }
                      label={
                        recipient.status.charAt(0) +
                        recipient.status.slice(1).toLowerCase()
                      }
                      aria-label={deliveryStatusMeaning[recipient.status]}
                      title={deliveryStatusMeaning[recipient.status]}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Attempts: {recipient.attempts} · Queued:{" "}
                    {dateFormat.format(recipient.createdAt)}
                    {recipient.sentAt &&
                      ` · SMTP accepted: ${dateFormat.format(recipient.sentAt)}`}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
        <Stack direction="row" spacing={1}>
          {data.hasCursor && (
            <Button href={`${base}/${communicationId}#recipient-deliveries`}>
              First recipients
            </Button>
          )}
          {data.nextCursor && (
            <Button
              href={`${base}/${communicationId}?after=${data.nextCursor}#recipient-deliveries`}
            >
              Next recipients
            </Button>
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}
