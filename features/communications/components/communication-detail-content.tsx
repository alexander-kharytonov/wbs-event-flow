"use client";

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
import { useLocale, useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { audienceLabel } from "@/features/communications/audiences";
import { RecipientPageLink } from "@/features/communications/components/communication-dialog";
import { CommunicationKind } from "@/features/communications/components/communication-kind";
import { RefreshCommunicationHistory } from "@/features/communications/components/compose-message";
import { DeliverySummary } from "@/features/communications/components/delivery-summary";
import {
  deliveryStatusColor,
  deliveryStatusLabel,
  deliveryStatusMeaning,
} from "@/features/communications/delivery-status";
import type { readCommunicationDetails } from "@/features/communications/server/read";
import { EventAccessStatus } from "@/features/events/components/event-access-status";

type Detail = NonNullable<Awaited<ReturnType<typeof readCommunicationDetails>>>;

export function CommunicationDetailContent({
  eventId: id,
  communicationId,
  data,
  timezone,
  modal,
}: {
  eventId: string;
  communicationId: string;
  data: Omit<Detail, "header">;
  timezone: string;
  modal: boolean;
}) {
  const t = useTranslations("events");
  const locale = useLocale();
  const item = data.communication;
  const base = `/dashboard/events/${id}/communications`;
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });

  return (
    <Stack spacing={3}>
      {!modal && (
        <Button
          href={`${base}#communication-history`}
          sx={{ alignSelf: "flex-start" }}
        >
          {t("commBack")}
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
              {dateFormat.format(item.createdAt)} · {timezone}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {item.audience
              ? t(audienceLabel(item.audience) ?? "commAudience")
              : t("commTrigger", { trigger: item.trigger ?? "" })}
            {" · "}
            {t("commRecipients", { count: item.recipientCount })}
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
              {item.actorNameSnapshot ?? t("commNoActor")}
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
            {item.kind === "MANUAL" ? t("commMessage") : t("commContext")}
          </Typography>
          {item.context.eventTitle && (
            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
              {t("commSavedTitle", { title: item.context.eventTitle })}
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
            <Alert severity="info">{t("commContentNotStored")}</Alert>
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
            {t("commDeliveries")}
          </Typography>
          <RefreshCommunicationHistory />
        </Stack>
        <Alert severity="info">{t("commDeliveryExplanation")}</Alert>
        <Typography variant="body2" color="text.secondary">
          {t("commFrozenHint")}
        </Typography>
        {data.recipients.length === 0 ? (
          <EmptyState
            icon={<PeopleOutlined />}
            title={
              item.recipientCount === 0
                ? t("commNoRecipients")
                : t("commNoMoreRecipients")
            }
            description={
              item.recipientCount === 0
                ? t("commNoRecipientsHint")
                : t("commRecipientsEnd")
            }
          />
        ) : (
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            <List disablePadding aria-label={t("commDeliveries")}>
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
                        {t("commAttempts", {
                          count: recipient.attempts,
                          date: dateFormat.format(recipient.createdAt),
                        })}
                      </Typography>
                      {recipient.sentAt && (
                        <Typography variant="caption" color="text.secondary">
                          {t("commAccepted", {
                            date: dateFormat.format(recipient.sentAt),
                          })}
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
                      label={t(deliveryStatusLabel[recipient.status])}
                      aria-label={t(deliveryStatusMeaning[recipient.status])}
                      title={t(deliveryStatusMeaning[recipient.status])}
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
              {t("commFirstRecipients")}
            </RecipientPageLink>
          )}
          {data.nextCursor && (
            <RecipientPageLink
              modal={modal}
              href={`${base}/${communicationId}?after=${data.nextCursor}#recipient-deliveries`}
            >
              {t("commNextRecipients")}
            </RecipientPageLink>
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}
