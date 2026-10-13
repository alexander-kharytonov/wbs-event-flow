import BlockOutlined from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import Close from "@mui/icons-material/Close";
import HowToRegOutlined from "@mui/icons-material/HowToRegOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import RadioButtonUncheckedOutlined from "@mui/icons-material/RadioButtonUncheckedOutlined";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { useLocale, useTranslations } from "next-intl";
import { formatEventTime } from "@/features/events/format-event-time";
import type { OrganizerAttendee } from "@/features/events/server/organizer-attendees";

export function AttendeeDetailDialog({
  selected,
  active,
  eventId,
  timezone,
  lifecycle,
  full,
  canPrintBadges,
  canCheckIn,
  pending,
  closeDetail,
  checkIn,
}: {
  selected: OrganizerAttendee | undefined;
  active: boolean;
  eventId: string;
  timezone: string;
  lifecycle: "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
  full: boolean;
  canPrintBadges: boolean;
  canCheckIn: boolean;
  pending: boolean;
  closeDetail: () => void;
  checkIn: () => void;
}) {
  const t = useTranslations("events");
  const locale = useLocale();

  return (
    <Dialog
      open={Boolean(selected)}
      onClose={closeDetail}
      fullWidth
      maxWidth="md"
      aria-labelledby="attendee-detail-title"
      slotProps={{
        paper: {
          sx: {
            m: { xs: 1, sm: 4 },
            width: { xs: "calc(100% - 16px)", sm: "calc(100% - 64px)" },
            maxHeight: { xs: "calc(100% - 16px)", sm: "calc(100% - 64px)" },
          },
        },
      }}
    >
      {selected && (
        <>
          <DialogTitle id="attendee-detail-title" sx={{ pr: 7 }}>
            {t("attendeeDetail")}
            <IconButton
              aria-label={t("attendeeClose")}
              onClick={closeDetail}
              disabled={pending}
              sx={{ position: "absolute", right: 12, top: 12 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ overflowWrap: "anywhere" }}>
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", sm: "center" },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h5" component="h3">
                      {selected.name}
                    </Typography>
                    {full && (
                      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                        {selected.email}
                      </Typography>
                    )}
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      {selected.kind === "GUEST"
                        ? t("attendeeGuestOf", {
                            name:
                              selected.registration.attendees[0]?.name ??
                              t("unavailable"),
                          })
                        : t("primaryAttendee")}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: { xs: "flex-start", sm: "flex-end" },
                    }}
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      label={
                        active
                          ? t("attendeeAdmissionActive")
                          : t("attendeeAdmissionRevoked")
                      }
                      color={active ? "success" : "default"}
                      icon={
                        active ? <CheckCircleOutlined /> : <BlockOutlined />
                      }
                      sx={{ borderRadius: 1, fontWeight: 600 }}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={
                        selected.attendance
                          ? t("checkedIn")
                          : t("attendeeNotChecked")
                      }
                      color={selected.attendance ? "success" : "default"}
                      icon={
                        selected.attendance ? (
                          <HowToRegOutlined />
                        ) : (
                          <RadioButtonUncheckedOutlined />
                        )
                      }
                      sx={{ borderRadius: 1, fontWeight: 600 }}
                    />
                  </Stack>
                </Stack>
                <Box sx={{ bgcolor: "background.default", p: 2 }}>
                  <Box
                    component="dl"
                    sx={{
                      m: 0,
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                      },
                      gap: 2,
                      "& dt": {
                        typography: "caption",
                        color: "text.secondary",
                        mb: 0.5,
                      },
                      "& dd": { m: 0, typography: "body2" },
                    }}
                  >
                    {selected.createdAt && (
                      <Box>
                        <Typography component="dt">
                          {t("attendeeAdmissionGranted")}
                        </Typography>
                        <Typography component="dd">
                          {selected.createdAt &&
                            formatEventTime(
                              selected.createdAt,
                              timezone,
                              locale,
                            )}
                        </Typography>
                      </Box>
                    )}
                    {(selected.revokedAt ||
                      selected.registration.revokedAt) && (
                      <Box>
                        <Typography component="dt">
                          {t("attendeeAdmissionRevoked")}
                        </Typography>
                        <Typography component="dd">
                          {formatEventTime(
                            (selected.revokedAt ??
                              selected.registration.revokedAt) as Date,
                            timezone,
                            locale,
                          )}
                        </Typography>
                      </Box>
                    )}
                    <Box>
                      <Typography component="dt">
                        {t("attendeeTicketStatus")}
                      </Typography>
                      <Typography component="dd">
                        {selected.ticket
                          ? selected.ticket.revokedAt
                            ? t("attendeeRevoked")
                            : t("active")
                          : t("unavailable")}
                      </Typography>
                    </Box>
                    {selected.ticket && (
                      <Box sx={{ gridColumn: "1 / -1" }}>
                        <Typography component="dt">
                          {t("ticketNumber")}
                        </Typography>
                        <Typography
                          component="dd"
                          sx={{ fontFamily: "monospace" }}
                        >
                          {selected.ticket.number}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1.5 }}
                  >
                    {t("allTimesIn", { timezone })}
                  </Typography>
                </Box>
              </Stack>
              <Stack spacing={1.5}>
                <Typography variant="h6" component="h3">
                  {t("attendeeAttendance")}
                </Typography>
                {selected.attendance ? (
                  <Box
                    component="dl"
                    sx={{
                      m: 0,
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                      },
                      gap: 2,
                      "& dt": {
                        typography: "caption",
                        color: "text.secondary",
                        mb: 0.5,
                      },
                      "& dd": { m: 0, typography: "body2" },
                    }}
                  >
                    <Box sx={{ gridColumn: "1 / -1" }}>
                      <Typography component="dt">
                        {t("attendeeCheckedAt")}
                      </Typography>
                      <Typography component="dd">
                        {formatEventTime(
                          selected.attendance.checkedInAt,
                          timezone,
                          locale,
                        )}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography component="dt">
                        {t("attendeeMethod")}
                      </Typography>
                      <Typography component="dd">
                        {selected.attendance.method === "QR"
                          ? t("attendeeQr")
                          : t("attendeeManual")}
                      </Typography>
                    </Box>
                    {full && (
                      <Box>
                        <Typography component="dt">
                          {t("attendeeCheckedBy")}
                        </Typography>
                        <Typography component="dd">
                          {selected.attendance.checkedInByUser?.name ||
                            t("unavailable")}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {lifecycle === "Upcoming"
                      ? t("attendeeOpensHint")
                      : lifecycle === "Cancelled"
                        ? t("attendeeCancelled")
                        : lifecycle === "Completed"
                          ? t("attendeeClosed")
                          : t("attendeeNotCheckedHint")}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </DialogContent>
          {(canCheckIn || canPrintBadges) && (
            <DialogActions>
              {canPrintBadges && (
                <Button
                  variant="outlined"
                  startIcon={<PrintOutlined />}
                  href={`/print/events/${eventId}/badges/${selected.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  disabled={pending}
                >
                  {t("badgePrint")}
                </Button>
              )}
              {canCheckIn && (
                <Button variant="contained" loading={pending} onClick={checkIn}>
                  {t("attendeeManualCheckIn")}
                </Button>
              )}
            </DialogActions>
          )}
        </>
      )}
    </Dialog>
  );
}
