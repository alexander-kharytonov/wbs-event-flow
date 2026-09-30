"use client";

import BlockOutlined from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import HowToRegOutlined from "@mui/icons-material/HowToRegOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import RadioButtonUncheckedOutlined from "@mui/icons-material/RadioButtonUncheckedOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { checkInManuallyAction } from "@/features/attendance/check-in-manually-action";
import type { ManualCheckInResult } from "@/features/attendance/check-in-result";
import { formatEventTime } from "@/features/events/format-event-time";
import type { OrganizerAttendee } from "@/features/events/server/organizer-attendees";

function isActive(attendee: OrganizerAttendee) {
  return !attendee.revokedAt && !attendee.registration.revokedAt;
}

function resultMessage(result: ManualCheckInResult, timezone: string) {
  switch (result.code) {
    case "CHECKED_IN":
      return "Checked in successfully.";
    case "ALREADY_CHECKED_IN":
      return `Already checked in · ${formatEventTime(new Date(result.checkedInAt), timezone)} (${timezone}).`;
    case "EVENT_CANCELLED":
      return "This event is cancelled. New check-ins are unavailable.";
    case "CHECK_IN_NOT_OPEN":
      return `Check-in opens ${formatEventTime(new Date(result.boundaryAt), timezone)} (${timezone}).`;
    case "CHECK_IN_CLOSED":
      return `Check-in closed ${formatEventTime(new Date(result.boundaryAt), timezone)} (${timezone}).`;
    case "ADMISSION_REVOKED":
      return "This admission is no longer active.";
    case "UNAVAILABLE":
    case "FAILED":
      return result.message;
  }
}

export function AttendeesList({
  eventId,
  attendees,
  timezone,
  lifecycle,
}: {
  eventId: string;
  attendees: OrganizerAttendee[];
  timezone: string;
  lifecycle: "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [admission, setAdmission] = useState<"all" | "active" | "revoked">(
    "all",
  );
  const [attendance, setAttendance] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<ManualCheckInResult | null>(null);
  const [pending, startTransition] = useTransition();
  const query = search.trim().toLowerCase();
  const visible = attendees.filter((person) => {
    if (admission !== "all" && isActive(person) !== (admission === "active")) {
      return false;
    }

    if (
      attendance !== "all" &&
      Boolean(person.attendance) !== (attendance === "checked")
    ) {
      return false;
    }

    return [person.name, person.email, person.ticket?.number].some((value) =>
      value?.toLowerCase().includes(query),
    );
  });
  // Resolve by ID from fresh props: realtime refresh also updates an open dialog.
  const selected = attendees.find((person) => person.id === selectedId);
  const success =
    result?.code === "CHECKED_IN" || result?.code === "ALREADY_CHECKED_IN";
  const canCheckIn =
    selected &&
    isActive(selected) &&
    !selected.attendance &&
    lifecycle === "Ongoing" &&
    !success;
  function closeDetail() {
    if (pending) {
      return;
    }

    setSelectedId(null);
    setResult(null);
  }

  function checkIn() {
    if (!selected || pending) {
      return;
    }

    const attendeeId = selected.id;
    setResult(null);
    startTransition(async () => {
      try {
        const response = await checkInManuallyAction({ eventId, attendeeId });
        setResult(response);
        router.refresh();
      } catch {
        setResult({
          code: "FAILED",
          message: "Could not check in this attendee. Please try again.",
        });
      }
    });
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{
          "& .MuiSelect-select": {
            display: "flex",
            alignItems: "center",
          },
          "& .MuiOutlinedInput-notchedOutline": {
            transition: "border-color 150ms ease",
          },
          "& .MuiOutlinedInput-root:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline":
            { borderColor: "divider" },
          "& .MuiOutlinedInput-root:hover:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline":
            {
              borderColor:
                "color-mix(in srgb, var(--mui-palette-divider), var(--mui-palette-text-secondary) 25%)",
            },
        }}
      >
        <TextField
          label="Search attendees"
          placeholder="Name, email or ticket number"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: 1 }}
        />
        <TextField
          select
          label="Admission"
          value={admission}
          onChange={(event) =>
            setAdmission(
              event.target.value === "all"
                ? "all"
                : event.target.value === "revoked"
                  ? "revoked"
                  : "active",
            )
          }
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
            >
              <PeopleOutlined fontSize="small" />
              All
            </Box>
          </MenuItem>
          <MenuItem value="active">
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                color: "success.main",
              }}
            >
              <CheckCircleOutlined fontSize="small" />
              Active
            </Box>
          </MenuItem>
          <MenuItem value="revoked">
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
            >
              <BlockOutlined fontSize="small" />
              Revoked
            </Box>
          </MenuItem>
        </TextField>
        <TextField
          select
          label="Attendance"
          value={attendance}
          onChange={(event) => setAttendance(event.target.value)}
          sx={{ minWidth: 210 }}
        >
          <MenuItem value="all">
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
            >
              <PeopleOutlined fontSize="small" />
              All
            </Box>
          </MenuItem>
          <MenuItem value="checked">
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                color: "success.main",
              }}
            >
              <HowToRegOutlined fontSize="small" />
              Checked in
            </Box>
          </MenuItem>
          <MenuItem value="not-checked">
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
            >
              <RadioButtonUncheckedOutlined fontSize="small" />
              Not checked in
            </Box>
          </MenuItem>
        </TextField>
      </Stack>
      {visible.length === 0 ? (
        <EmptyState
          icon={<PeopleOutlined />}
          title={
            attendees.length ? "No matching attendees" : "No attendees yet"
          }
          description={
            attendees.length
              ? "Try another search or change the filters."
              : "Attendees appear when you approve an application."
          }
        />
      ) : (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <List disablePadding aria-label="Event attendees">
            {visible.map((person, index) => {
              const nameParts = person.name
                .trim()
                .split(/\s+/u)
                .filter(Boolean);
              const initials = [
                nameParts[0],
                ...(nameParts.length > 1
                  ? [nameParts[nameParts.length - 1]]
                  : []),
              ]
                .map((part) => Array.from(part ?? "")[0] ?? "")
                .join("")
                .toUpperCase();
              let colorHash = 0;

              for (const character of initials) {
                colorHash =
                  (colorHash * 31 + (character.codePointAt(0) ?? 0)) % 360;
              }

              return (
                <ListItem
                  key={person.id}
                  disablePadding
                  divider={index < visible.length - 1}
                >
                  <ListItemButton
                    onClick={() => {
                      setResult(null);
                      setSelectedId(person.id);
                    }}
                    aria-label={`Open attendee ${person.name}`}
                    aria-haspopup="dialog"
                    alignItems="flex-start"
                    sx={{
                      px: { xs: 2, sm: 3 },
                      py: 2.5,
                      gap: { xs: 1.5, sm: 2 },
                      minWidth: 0,
                    }}
                  >
                    <ListItemAvatar sx={{ minWidth: 0, mt: 0.5 }}>
                      <Avatar
                        sx={{
                          bgcolor: `hsl(${colorHash}, 55%, 32%)`,
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {initials}
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
                      <ListItemText
                        sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere" }}
                        primary={person.name}
                        secondary={
                          <>
                            {person.email && (
                              <Typography
                                component="span"
                                variant="body2"
                                sx={{
                                  display: "block",
                                  color: "text.primary",
                                  mt: 0.25,
                                }}
                              >
                                {person.email}
                              </Typography>
                            )}
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{ display: "block", mt: 0.5 }}
                            >
                              {person.kind === "GUEST"
                                ? `Guest · Guest of ${person.registration.attendees[0]?.name ?? "Unavailable"}`
                                : "Primary"}
                              {person.ticket
                                ? ` · ${person.ticket.number}`
                                : ""}
                            </Typography>
                          </>
                        }
                        slotProps={{
                          primary: {
                            component: "div",
                            sx: { fontWeight: 600 },
                          },
                          secondary: { component: "div" },
                        }}
                      />
                      <Stack
                        direction="row"
                        useFlexGap
                        spacing={1.5}
                        sx={{
                          alignItems: "center",
                          flexWrap: "wrap",
                          flexShrink: 0,
                          maxWidth: "100%",
                        }}
                      >
                        <Chip
                          size="small"
                          variant="outlined"
                          label={isActive(person) ? "Active" : "Revoked"}
                          color={isActive(person) ? "success" : "default"}
                          icon={
                            isActive(person) ? (
                              <CheckCircleOutlined />
                            ) : (
                              <BlockOutlined />
                            )
                          }
                          sx={{ borderRadius: 1, fontWeight: 600 }}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={
                            person.attendance ? "Checked in" : "Not checked in"
                          }
                          color={person.attendance ? "success" : "default"}
                          icon={
                            person.attendance ? (
                              <HowToRegOutlined />
                            ) : (
                              <RadioButtonUncheckedOutlined />
                            )
                          }
                          sx={{ borderRadius: 1, fontWeight: 600 }}
                        />
                      </Stack>
                    </Box>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Paper>
      )}
      <Dialog
        open={Boolean(selected)}
        onClose={closeDetail}
        fullWidth
        maxWidth="sm"
        aria-labelledby="attendee-detail-title"
      >
        {selected && (
          <>
            <DialogTitle
              id="attendee-detail-title"
              sx={{ overflowWrap: "anywhere" }}
            >
              {selected.name}
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ overflowWrap: "anywhere" }}>
                <Box>
                  <Typography>
                    {selected.email ?? "No email provided"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selected.kind === "GUEST"
                      ? `Guest · Guest of ${selected.registration.attendees[0]?.name ?? "Unavailable"}`
                      : "Primary"}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>
                    Admission · {isActive(selected) ? "Active" : "Revoked"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Granted {formatEventTime(selected.createdAt, timezone)} (
                    {timezone})
                  </Typography>
                  {(selected.revokedAt || selected.registration.revokedAt) && (
                    <Typography variant="body2" color="text.secondary">
                      Revoked{" "}
                      {formatEventTime(
                        (selected.revokedAt ??
                          selected.registration.revokedAt) as Date,
                        timezone,
                      )}{" "}
                      ({timezone})
                    </Typography>
                  )}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>
                    Ticket ·{" "}
                    {selected.ticket
                      ? selected.ticket.revokedAt
                        ? "Revoked"
                        : "Active"
                      : "Unavailable"}
                  </Typography>
                  {selected.ticket && (
                    <Typography variant="body2">
                      {selected.ticket.number}
                    </Typography>
                  )}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>
                    {selected.attendance ? "Checked in" : "Not checked in"}
                  </Typography>
                  {selected.attendance ? (
                    <>
                      <Typography variant="body2">
                        {formatEventTime(
                          selected.attendance.checkedInAt,
                          timezone,
                        )}{" "}
                        ({timezone})
                      </Typography>
                      <Typography variant="body2">
                        Method:{" "}
                        {selected.attendance.method === "QR" ? "QR" : "Manual"}
                      </Typography>
                      <Typography variant="body2">
                        Checked in by:{" "}
                        {selected.attendance.checkedInByUser?.name ||
                          "Unavailable"}
                      </Typography>
                    </>
                  ) : (
                    lifecycle !== "Ongoing" && (
                      <Typography variant="body2" color="text.secondary">
                        {lifecycle === "Upcoming"
                          ? "Check-in opens when the event starts."
                          : lifecycle === "Cancelled"
                            ? "This event is cancelled."
                            : "Check-in is closed."}
                      </Typography>
                    )
                  )}
                </Box>
                {result && (
                  <Alert
                    severity={
                      success
                        ? "success"
                        : result.code === "FAILED"
                          ? "error"
                          : "info"
                    }
                    role="status"
                  >
                    {resultMessage(result, timezone)}
                  </Alert>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button autoFocus onClick={closeDetail} disabled={pending}>
                Close
              </Button>
              {canCheckIn && (
                <Button variant="contained" loading={pending} onClick={checkIn}>
                  Manual check-in
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Stack>
  );
}
