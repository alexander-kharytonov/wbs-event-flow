"use client";

import BlockOutlined from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import HowToRegOutlined from "@mui/icons-material/HowToRegOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import RadioButtonUncheckedOutlined from "@mui/icons-material/RadioButtonUncheckedOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import {
  Box,
  InputAdornment,
  List,
  ListItem,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { checkInManuallyAction } from "@/features/attendance/check-in-manually-action";
import type { ManualCheckInResult } from "@/features/attendance/check-in-result";
import { CheckInFeedback } from "@/features/attendance/components/check-in-feedback";
import { AttendeeDetailDialog } from "@/features/events/components/attendee-detail-dialog";
import { AttendeeRow } from "@/features/events/components/attendee-row";
import { EventText } from "@/features/events/components/event-text";
import type { OrganizerAttendee } from "@/features/events/server/organizer-attendees";
import { useNotifications } from "@/hooks/use-notifications";

function isActive(attendee: OrganizerAttendee) {
  return !attendee.revokedAt && !attendee.registration.revokedAt;
}

export function AttendeesList({
  eventId,
  attendees,
  timezone,
  lifecycle,
  full = true,
  canPrintBadges,
}: {
  canPrintBadges: boolean;
  full?: boolean;
  eventId: string;
  attendees: OrganizerAttendee[];
  timezone: string;
  lifecycle: "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
}) {
  const t = useTranslations("events");
  const router = useRouter();
  const notifications = useNotifications();
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
  function openDetail(id: string) {
    setResult(null);
    setSelectedId(id);
  }

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
    notifications.close(`check-in:${attendeeId}`);
    setResult(null);
    startTransition(async () => {
      try {
        const response = await checkInManuallyAction({ eventId, attendeeId });
        setResult(response);

        notifications.show(
          <CheckInFeedback result={response} timezone={timezone} />,
          {
            severity:
              response.code === "CHECKED_IN"
                ? "success"
                : response.code === "FAILED"
                  ? "error"
                  : "info",
            key: `check-in:${attendeeId}`,
          },
        );

        router.refresh();
      } catch {
        notifications.show(<EventText id="checkInFailed" />, {
          severity: "error",
          key: `check-in:${attendeeId}`,
        });
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
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
          },
        }}
      >
        <TextField
          label={t("attendeeSearch")}
          placeholder={
            full ? t("attendeeSearchFull") : t("attendeeSearchRestricted")
          }
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
            gridTemplateColumns: full
              ? "repeat(2, minmax(0, 1fr))"
              : "minmax(0, 1fr)",
            gap: 1.5,
            minWidth: 0,
          }}
        >
          {full && (
            <TextField
              select
              label={t("attendeeAdmission")}
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
                  {t("all")}
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
                  {t("active")}
                </Box>
              </MenuItem>
              <MenuItem value="revoked">
                <Box
                  component="span"
                  sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
                >
                  <BlockOutlined fontSize="small" />
                  {t("attendeeRevoked")}
                </Box>
              </MenuItem>
            </TextField>
          )}
          <TextField
            select
            label={t("attendeeAttendance")}
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
                {t("all")}
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
                {t("checkedIn")}
              </Box>
            </MenuItem>
            <MenuItem value="not-checked">
              <Box
                component="span"
                sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
              >
                <RadioButtonUncheckedOutlined fontSize="small" />
                {t("attendeeNotChecked")}
              </Box>
            </MenuItem>
          </TextField>
        </Box>
      </Stack>
      {visibleGroups.length === 0 ? (
        <EmptyState
          icon={<PeopleOutlined />}
          title={attendees.length ? t("attendeeNoMatch") : t("attendeeEmpty")}
          description={
            attendees.length ? t("trySearchFilters") : t("attendeeEmptyHint")
          }
        />
      ) : (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <List disablePadding aria-label={t("attendeeList")}>
            {visibleGroups.map(({ primary, guests, contextOnly }, index) => (
              <ListItem
                key={primary.id}
                disablePadding
                divider={index < visibleGroups.length - 1}
                sx={{ display: "block" }}
              >
                <AttendeeRow
                  person={primary}
                  active={isActive(primary)}
                  contextOnly={contextOnly}
                  onSelect={openDetail}
                />
                {guests.length > 0 && (
                  <List
                    disablePadding
                    aria-label={t("attendeeGuestsOf", { name: primary.name })}
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
                        <AttendeeRow
                          person={guest}
                          active={isActive(guest)}
                          onSelect={openDetail}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
      <AttendeeDetailDialog
        selected={selected}
        active={Boolean(selected && isActive(selected))}
        eventId={eventId}
        timezone={timezone}
        lifecycle={lifecycle}
        full={full}
        canPrintBadges={canPrintBadges}
        canCheckIn={Boolean(canCheckIn)}
        pending={pending}
        closeDetail={closeDetail}
        checkIn={checkIn}
      />
    </Stack>
  );
}
