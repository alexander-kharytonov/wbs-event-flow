"use client";

import ConfirmationNumberOutlined from "@mui/icons-material/ConfirmationNumberOutlined";
import { Alert, Box, Paper, Stack, Typography } from "@mui/material";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { DateTime } from "@/components/ui/date-time";
import type { TicketPresentation } from "@/features/tickets/server/ticket-display";

export function TicketCard({
  ticket,
  title,
  background = "paper",
}: {
  ticket: TicketPresentation;
  title?: React.ReactNode;
  background?: "paper" | "default";
}) {
  const t = useTranslations("events");
  const formatter = useFormatter();
  const { context, revoked, cancelled, completed, qrDataUrl } = ticket;
  const timezone = context?.timezone ?? "UTC";

  const dateLabel = (date: Date) =>
    formatter.dateTime(date, {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 3 },
        bgcolor: `background.${background}`,
        overflowWrap: "anywhere",
        minWidth: 0,
        containerType: "inline-size",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack spacing={2} sx={{ flex: 1 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <ConfirmationNumberOutlined color="primary" />
          <Typography variant="h6" component="h2">
            {title ?? t("yourTicket")}
          </Typography>
        </Stack>
        <Stack
          spacing={3}
          useFlexGap
          sx={{
            flex: 1,
            flexDirection: "column",
            "@container (min-width: 640px)": {
              flexDirection: "row",
              alignItems: "center",
            },
          }}
        >
          <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {context?.title ?? t("eventDetailsUnavailable")}
            </Typography>
            {context && (
              <DateTime
                date={context.startsAt}
                endDate={context.endsAt}
                timezone={context.timezone}
              />
            )}
            <Box>
              <Typography>{ticket.attendeeName}</Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ minHeight: "1lh" }}
              >
                {ticket.attendeeEmail}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t("ticketNumber")}
              </Typography>
              <Typography
                sx={{
                  fontFamily: "monospace",
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                {ticket.number}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t("ticketIssuedAt", {
                date: dateLabel(ticket.issuedAt),
                timezone,
              })}
            </Typography>
            {ticket.checkedInAt && (
              <Alert severity="success">
                {t("checkedInAt", {
                  date: dateLabel(ticket.checkedInAt),
                  timezone,
                })}
              </Alert>
            )}
            {ticket.revokedAt && (
              <Typography variant="caption" color="text.secondary">
                {t("admissionRevokedAt", {
                  date: dateLabel(ticket.revokedAt),
                  timezone,
                })}
              </Typography>
            )}
          </Stack>
          {qrDataUrl && (
            <Stack
              spacing={1}
              sx={{
                alignItems: "center",
                alignSelf: "center",
                flexShrink: 0,
                maxWidth: "100%",
              }}
            >
              <Box
                sx={{
                  width: 240,
                  maxWidth: "100%",
                  bgcolor: "#fff",
                  borderRadius: 1,
                  overflow: "hidden",
                  "& svg": { display: "block", width: "100%", height: "auto" },
                }}
              >
                <Image
                  unoptimized
                  src={qrDataUrl}
                  alt={t("ticketQr")}
                  width={240}
                  height={240}
                  style={{ display: "block", width: "100%", height: "auto" }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t("keepQrPrivate")}
              </Typography>
            </Stack>
          )}
        </Stack>
        {revoked && <Alert severity="info">{t("ticketRevoked")}</Alert>}
        {cancelled && <Alert severity="error">{t("cancelledTicketQr")}</Alert>}
        {!cancelled && completed && (
          <Alert severity="info">{t("completedTicketHistory")}</Alert>
        )}
      </Stack>
    </Paper>
  );
}
