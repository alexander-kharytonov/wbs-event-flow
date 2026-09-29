import "server-only";
import ConfirmationNumberOutlined from "@mui/icons-material/ConfirmationNumberOutlined";
import { Alert, Box, Chip, Paper, Stack, Typography } from "@mui/material";
import Image from "next/image";
import { DateTime } from "@/components/ui/date-time";
import { formatEventTime } from "@/features/events/format-event-time";
import type { TicketPresentation } from "@/features/tickets/server/ticket-display";

export function TicketCard({ ticket }: { ticket: TicketPresentation }) {
  const { context, revoked, cancelled, completed, qrDataUrl } = ticket;
  const usable = !revoked && !cancelled;
  const timezone = context?.timezone ?? "UTC";

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 3 },
        overflowWrap: "anywhere",
        minWidth: 0,
        containerType: "inline-size",
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <ConfirmationNumberOutlined color="primary" />
          <Typography variant="h6" component="h2">
            Your ticket
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={usable ? "success" : "default"}
            label={
              revoked
                ? "Ticket revoked"
                : cancelled
                  ? "Event cancelled"
                  : "Registration confirmed"
            }
          />
        </Stack>
        <Stack
          spacing={3}
          useFlexGap
          sx={{
            flexDirection: "column",
            "@container (min-width: 640px)": {
              flexDirection: "row",
              alignItems: "center",
            },
          }}
        >
          <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {context?.title ?? "Event details unavailable"}
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
              <Typography variant="body2" color="text.secondary">
                {ticket.attendeeEmail}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Ticket number
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
              Issued {formatEventTime(ticket.issuedAt, timezone)} ({timezone})
            </Typography>
            {ticket.checkedInAt && (
              <Alert severity="success">
                Checked in · {formatEventTime(ticket.checkedInAt, timezone)} (
                {timezone})
              </Alert>
            )}
            {ticket.revokedAt && (
              <Typography variant="caption" color="text.secondary">
                Revoked {formatEventTime(ticket.revokedAt, timezone)} (
                {timezone})
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
                  alt="Ticket QR code"
                  width={240}
                  height={240}
                  style={{ display: "block", width: "100%", height: "auto" }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Keep your ticket QR private.
              </Typography>
            </Stack>
          )}
        </Stack>
        {revoked && (
          <Alert severity="info">
            This ticket has been revoked. Its QR is no longer available.
          </Alert>
        )}
        {cancelled && (
          <Alert severity="error">
            Event cancelled. The ticket QR is unavailable.
          </Alert>
        )}
        {!cancelled && completed && (
          <Alert severity="info">
            Event completed. This ticket is preserved in your history.
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
