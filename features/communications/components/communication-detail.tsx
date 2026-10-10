import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { audienceLabel } from "@/features/communications/audiences";
import {
  CommunicationDialog,
  RecipientPageLink,
} from "@/features/communications/components/communication-dialog";
import { CommunicationKind } from "@/features/communications/components/communication-kind";
import { RefreshCommunicationHistory } from "@/features/communications/components/compose-message";
import {
  DeliverySummary,
  deliveryStatusColor,
} from "@/features/communications/components/delivery-summary";
import { deliveryStatusMeaning } from "@/features/communications/delivery-status";
import { readCommunicationDetails } from "@/features/communications/server/read";
import { EventAccessStatus } from "@/features/events/components/event-access-status";
import { EventHeader } from "@/features/events/components/event-header";

export async function CommunicationDetail({
  eventId: id,
  communicationId,
  after,
  modal = false,
}: {
  eventId: string;
  communicationId: string;
  after?: string;
  modal?: boolean;
}) {
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

  const content = (
    <Stack spacing={3}>
      {!modal && (
        <Button
          href={`${base}#communication-history`}
          sx={{ alignSelf: "flex-start" }}
        >
          Back to history
        </Button>
      )}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={1.75}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 1,
              justifyContent: "space-between",
              alignItems: { md: "flex-start" },
            }}
          >
            <Stack
              direction="row"
              useFlexGap
              sx={{
                gap: 1,
                alignItems: "center",
                flexWrap: "wrap",
                minWidth: 0,
              }}
            >
              <Typography
                variant="h5"
                component="h2"
                sx={{ overflowWrap: "anywhere", minWidth: 0 }}
              >
                {item.subject}
              </Typography>
              <CommunicationKind kind={item.kind} />
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              component="time"
              dateTime={item.createdAt.toISOString()}
              sx={{ flexShrink: 0, pt: { md: 0.5 } }}
            >
              {dateFormat.format(item.createdAt)} ·{" "}
              {data.header.context.timezone}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {item.audience
              ? audienceLabel(item.audience)
              : item.trigger?.replaceAll("_", " ").toLowerCase()}
            {" · "}
            {item.recipientCount}{" "}
            {item.recipientCount === 1 ? "recipient" : "recipients"}
          </Typography>
          <Stack
            direction="row"
            useFlexGap
            sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ overflowWrap: "anywhere", minWidth: 0 }}
            >
              {item.actorNameSnapshot ?? "No staff actor recorded"}
            </Typography>
            {item.actorRoleSnapshot && (
              <EventAccessStatus role={item.actorRoleSnapshot} />
            )}
          </Stack>
          <Box sx={{ pt: 1.5, borderTop: 1, borderColor: "divider" }}>
            <DeliverySummary
              recipientCount={item.recipientCount}
              counts={item.deliveryCounts}
              compact
            />
          </Box>
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
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Typography
            variant="h6"
            component="h3"
            id="recipient-deliveries-title"
          >
            Recipient deliveries
          </Typography>
          <RefreshCommunicationHistory />
        </Stack>
        <Alert severity="info">
          Pending: queued, awaiting an attempt. Processing: claimed by the
          dispatcher. Sent: accepted by the SMTP transport. Failed: automatic
          attempts exhausted. Sent does not confirm mailbox delivery, opening or
          reading.
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Frozen addresses, ordered by email · up to 50 per page. Delivery
          statuses update automatically.
        </Typography>
        {data.recipients.length === 0 ? (
          <EmptyState
            icon={<PeopleOutlined />}
            title={
              item.recipientCount === 0 ? "No recipients" : "No more recipients"
            }
            description={
              item.recipientCount === 0
                ? "No recipients were queued for this communication."
                : "You have reached the end of this recipient list."
            }
          />
        ) : (
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            <List disablePadding aria-label="Recipient deliveries">
              {data.recipients.map((recipient, index) => (
                <ListItem
                  key={recipient.id}
                  divider={index < data.recipients.length - 1}
                  sx={{
                    px: { xs: 2, sm: 3 },
                    py: 2.5,
                    gap: 2,
                    alignItems: "flex-start",
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 0, mt: 0.5 }}>
                    <Avatar
                      sx={{
                        bgcolor: "action.selected",
                        color: "primary.main",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {Array.from(recipient.recipientEmail)
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <Box
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: { xs: "column", md: "row" },
                      gap: 2,
                      alignItems: { md: "center" },
                    }}
                  >
                    <Stack
                      spacing={0.5}
                      sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}
                    >
                      <Typography sx={{ fontWeight: 600 }}>
                        {recipient.recipientEmail}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Attempts: {recipient.attempts} · Queued:{" "}
                        {dateFormat.format(recipient.createdAt)}
                      </Typography>
                      {recipient.sentAt && (
                        <Typography variant="caption" color="text.secondary">
                          SMTP accepted: {dateFormat.format(recipient.sentAt)}
                        </Typography>
                      )}
                    </Stack>
                    <Chip
                      size="small"
                      variant="outlined"
                      sx={{
                        flexShrink: 0,
                        alignSelf: { xs: "flex-start", md: "center" },
                      }}
                      color={deliveryStatusColor[recipient.status]}
                      label={
                        recipient.status.charAt(0) +
                        recipient.status.slice(1).toLowerCase()
                      }
                      aria-label={deliveryStatusMeaning[recipient.status]}
                      title={deliveryStatusMeaning[recipient.status]}
                    />
                  </Box>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
        <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: "wrap" }}>
          {data.hasCursor && (
            <RecipientPageLink
              modal={modal}
              href={`${base}/${communicationId}#recipient-deliveries`}
            >
              First recipients
            </RecipientPageLink>
          )}
          {data.nextCursor && (
            <RecipientPageLink
              modal={modal}
              href={`${base}/${communicationId}?after=${data.nextCursor}#recipient-deliveries`}
            >
              Next recipients
            </RecipientPageLink>
          )}
        </Stack>
      </Stack>
    </Stack>
  );

  return modal ? (
    <CommunicationDialog>{content}</CommunicationDialog>
  ) : (
    <EventHeader eventId={id} active="communications" data={data.header}>
      {content}
    </EventHeader>
  );
}
