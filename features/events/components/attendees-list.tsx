"use client";

import BlockOutlined from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import Close from "@mui/icons-material/Close";
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
  IconButton,
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
  const matching = attendees.filter((person) => {
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
  const matchingIds = new Set(matching.map(({ id }) => id));
  const guestsByRegistration = new Map<string, OrganizerAttendee[]>();

  for (const person of matching) {
    if (person.kind === "GUEST") {
      const guests = guestsByRegistration.get(person.registrationId) ?? [];
      guests.push(person);
      guestsByRegistration.set(person.registrationId, guests);
    }
  }

  const visibleGroups = attendees
    .filter((person) => person.kind === "PRIMARY")
    .map((primary) => ({
      primary,
      guests: guestsByRegistration.get(primary.registrationId) ?? [],
      contextOnly: !matchingIds.has(primary.id),
    }))
    .filter(({ contextOnly, guests }) => !contextOnly || guests.length > 0);
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

  function renderAttendee(person: OrganizerAttendee, contextOnly = false) {
    const nameParts = person.name.trim().split(/\s+/u).filter(Boolean);
    const initials = [
      nameParts[0],
      ...(nameParts.length > 1 ? [nameParts[nameParts.length - 1]] : []),
    ]
      .map((part) => Array.from(part ?? "")[0] ?? "")
      .join("")
      .toUpperCase();
    let colorHash = 0;

    for (const character of initials) {
      colorHash = (colorHash * 31 + (character.codePointAt(0) ?? 0)) % 360;
    }

    return (
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
          py: 2,
          ...(contextOnly ? { bgcolor: "action.hover" } : {}),
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
                  {person.kind === "GUEST" ? "Guest" : "Primary attendee"}
                  {person.ticket ? ` · ${person.ticket.number}` : ""}
                  {contextOnly ? " · Shown for guest context" : ""}
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
                isActive(person) ? <CheckCircleOutlined /> : <BlockOutlined />
              }
              sx={{ borderRadius: 1, fontWeight: 600 }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={person.attendance ? "Checked in" : "Not checked in"}
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
    );
  }

  return (
    <Stack spacing={2}>
      <Stack
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
          },
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
          sx={{ minWidth: 0 }}
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 1.5,
            minWidth: 0,
          }}
        >
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
            sx={{ minWidth: 0 }}
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
            sx={{ minWidth: 0 }}
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
        </Box>
      </Stack>
      {visibleGroups.length === 0 ? (
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
            {visibleGroups.map(({ primary, guests, contextOnly }, index) => (
              <ListItem
                key={primary.id}
                disablePadding
                divider={index < visibleGroups.length - 1}
                sx={{ display: "block" }}
              >
                {renderAttendee(primary, contextOnly)}
                {guests.length > 0 && (
                  <List
                    disablePadding
                    aria-label={`Guests of ${primary.name}`}
                    sx={{
                      ml: 2,
                      my: 2,
                      borderLeft: "2px solid",
                      borderTop: "2px solid",
                      borderBottom: "2px solid",
                      borderColor: "divider",
                      borderTopLeftRadius: 16,
                      borderBottomLeftRadius: 16,
                    }}
                  >
                    {guests.map((guest) => (
                      <ListItem key={guest.id} disablePadding>
                        {renderAttendee(guest)}
                      </ListItem>
                    ))}
                  </List>
                )}
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
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
              Attendee detail
              <IconButton
                aria-label="Close attendee"
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
                      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                        {selected.email ?? "No email provided"}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5 }}
                      >
                        {selected.kind === "GUEST"
                          ? `Guest of ${selected.registration.attendees[0]?.name ?? "Unavailable"}`
                          : "Primary attendee"}
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
                          isActive(selected)
                            ? "Admission active"
                            : "Admission revoked"
                        }
                        color={isActive(selected) ? "success" : "default"}
                        icon={
                          isActive(selected) ? (
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
                          selected.attendance ? "Checked in" : "Not checked in"
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
                      <Box>
                        <Typography component="dt">
                          Admission granted
                        </Typography>
                        <Typography component="dd">
                          {formatEventTime(selected.createdAt, timezone)}
                        </Typography>
                      </Box>
                      {(selected.revokedAt ||
                        selected.registration.revokedAt) && (
                        <Box>
                          <Typography component="dt">
                            Admission revoked
                          </Typography>
                          <Typography component="dd">
                            {formatEventTime(
                              (selected.revokedAt ??
                                selected.registration.revokedAt) as Date,
                              timezone,
                            )}
                          </Typography>
                        </Box>
                      )}
                      <Box>
                        <Typography component="dt">Ticket status</Typography>
                        <Typography component="dd">
                          {selected.ticket
                            ? selected.ticket.revokedAt
                              ? "Revoked"
                              : "Active"
                            : "Unavailable"}
                        </Typography>
                      </Box>
                      {selected.ticket && (
                        <Box sx={{ gridColumn: "1 / -1" }}>
                          <Typography component="dt">Ticket number</Typography>
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
                      All times in {timezone}
                    </Typography>
                  </Box>
                </Stack>
                <Stack spacing={1.5}>
                  <Typography variant="h6" component="h3">
                    Attendance
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
                        <Typography component="dt">Checked in at</Typography>
                        <Typography component="dd">
                          {formatEventTime(
                            selected.attendance.checkedInAt,
                            timezone,
                          )}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography component="dt">Method</Typography>
                        <Typography component="dd">
                          {selected.attendance.method === "QR"
                            ? "QR code"
                            : "Manual"}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography component="dt">Checked in by</Typography>
                        <Typography component="dd">
                          {selected.attendance.checkedInByUser?.name ||
                            "Unavailable"}
                        </Typography>
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {lifecycle === "Upcoming"
                        ? "Check-in opens when the event starts."
                        : lifecycle === "Cancelled"
                          ? "This event is cancelled."
                          : lifecycle === "Completed"
                            ? "Check-in is closed."
                            : "This attendee has not checked in yet."}
                    </Typography>
                  )}
                </Stack>
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
            {canCheckIn && (
              <DialogActions>
                <Button variant="contained" loading={pending} onClick={checkIn}>
                  Manual check-in
                </Button>
              </DialogActions>
            )}
          </>
        )}
      </Dialog>
    </Stack>
  );
}
