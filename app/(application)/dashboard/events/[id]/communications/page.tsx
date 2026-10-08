import ChevronRight from "@mui/icons-material/ChevronRight";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { audienceLabel } from "@/features/communications/audiences";
import {
  ComposeMessage,
  RefreshCommunicationHistory,
} from "@/features/communications/components/compose-message";
import { DeliverySummary } from "@/features/communications/components/delivery-summary";
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
  const data = await readCommunicationHistory(id, before);

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
        <Alert severity="info">
          Sent means accepted by the mail transport, not confirmed mailbox
          delivery. Status counts update automatically; you can also refresh
          them.
        </Alert>
        {data.items.length === 0 ? (
          <EmptyState
            icon={<EmailOutlined />}
            title="No communications yet"
            description="Messages queued for this event will appear here."
          />
        ) : (
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            <List disablePadding aria-label="Communication history">
              {data.items.map((item, index) => (
                <ListItem
                  key={item.id}
                  disablePadding
                  divider={index < data.items.length - 1}
                >
                  <ListItemButton
                    href={`${base}/${item.id}`}
                    aria-label={`View communication: ${item.subject}`}
                    sx={{
                      px: { xs: 2, sm: 3 },
                      py: 2.5,
                      gap: 2,
                      alignItems: "flex-start",
                    }}
                  >
                    <ListItemAvatar
                      sx={{
                        minWidth: 0,
                        mt: 0.5,
                        display: { xs: "none", sm: "block" },
                      }}
                    >
                      <Avatar
                        sx={{
                          bgcolor: "action.selected",
                          color: "primary.main",
                        }}
                      >
                        <EmailOutlined />
                      </Avatar>
                    </ListItemAvatar>
                    <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: { xs: "column", md: "row" },
                          gap: 1,
                          justifyContent: "space-between",
                        }}
                      >
                        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                          <Typography
                            variant="subtitle1"
                            component="h3"
                            sx={{ overflowWrap: "anywhere" }}
                          >
                            {item.subject}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.audience
                              ? audienceLabel(item.audience)
                              : item.trigger
                                  ?.replaceAll("_", " ")
                                  .toLowerCase()}
                            {" · "}
                            {item.recipientCount} recipients
                          </Typography>
                          {item.actorNameSnapshot && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {item.actorNameSnapshot} ·{" "}
                              {item.actorRoleSnapshot}
                            </Typography>
                          )}
                        </Stack>
                        <Stack
                          spacing={0.75}
                          sx={{
                            alignItems: { xs: "flex-start", md: "flex-end" },
                            flexShrink: 0,
                          }}
                        >
                          <Chip
                            size="small"
                            label={
                              item.kind === "MANUAL"
                                ? "Manual"
                                : "Transactional"
                            }
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
                      </Box>
                      <DeliverySummary
                        recipientCount={item.recipientCount}
                        counts={item.deliveryCounts}
                      />
                    </Stack>
                    <ChevronRight
                      sx={{
                        alignSelf: "center",
                        color: "text.secondary",
                        display: { xs: "none", sm: "block" },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
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
