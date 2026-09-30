"use client";

import ArchiveOutlined from "@mui/icons-material/ArchiveOutlined";
import BlockOutlined from "@mui/icons-material/BlockOutlined";
import EventOutlined from "@mui/icons-material/EventOutlined";
import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import LinkOutlined from "@mui/icons-material/LinkOutlined";
import PlayCircleOutlined from "@mui/icons-material/PlayCircleOutlined";
import PublicOutlined from "@mui/icons-material/PublicOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import TaskAlt from "@mui/icons-material/TaskAlt";
import {
  Box,
  Button,
  CardActionArea,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { DateTime } from "@/components/ui/date-time";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CreateEventButton } from "@/features/events/components/create-event-button";
import { EventLifecycleStatus } from "@/features/events/components/event-lifecycle-status";
import { PublicationStatus } from "@/features/events/components/publication-status";
import { eventLifecycle } from "@/features/events/event-lifecycle";
import { publicationState } from "@/features/events/publication-state";

type EventSummary = {
  id: string;
  publicId: string | null;
  title: string;
  visibility: "PUBLIC" | "PRIVATE";
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
  archivedAt: Date | null;
  timezone: string;
  contentVersion: number;
  publishedRevision: { contentVersion: number } | null;
};

export function OrganizerEventResults({ events }: { events: EventSummary[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [visibility, setVisibility] = useState<"ALL" | "PUBLIC" | "PRIVATE">(
    "ALL",
  );
  const labels = { ALL: "All", PUBLIC: "Public", PRIVATE: "Private" };
  const statusLabels = { ALL: "All", ACTIVE: "Active", ARCHIVED: "Archived" };
  const [lifecycle, setLifecycle] = useState<
    "All" | ReturnType<typeof eventLifecycle>
  >("All");
  const now = new Date();
  const lifecycleOptions = [
    {
      value: "All",
      icon: <EventOutlined fontSize="small" />,
      color: "text.primary",
    },
    {
      value: "Upcoming",
      icon: <ScheduleOutlined fontSize="small" />,
      color: "info.main",
    },
    {
      value: "Ongoing",
      icon: <PlayCircleOutlined fontSize="small" />,
      color: "success.main",
    },
    {
      value: "Completed",
      icon: <TaskAlt fontSize="small" />,
      color: "text.secondary",
    },
    {
      value: "Cancelled",
      icon: <BlockOutlined fontSize="small" />,
      color: "error.main",
    },
  ] as const;

  const query = search.trim().toLowerCase();
  const visibleEvents = events.filter(
    (event) =>
      (status === "ALL" ||
        Boolean(event.archivedAt) === (status === "ARCHIVED")) &&
      (visibility === "ALL" || event.visibility === visibility) &&
      (lifecycle === "All" || eventLifecycle(event, now) === lifecycle) &&
      event.title.toLowerCase().includes(query),
  );

  return (
    <Stack spacing={3}>
      <PageHeader
        title="My events"
        description="Manage your events, registration forms, and applications."
        actions={status !== "ARCHIVED" && <CreateEventButton />}
      />
      <Stack
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: "repeat(2, minmax(0, 1fr))",
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
          label="Search events"
          placeholder="Event title"
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
            gap: 1.5,
            minWidth: 0,
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
            },
          }}
        >
          <TextField
            select
            label="Status"
            value={status}
            sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", md: "auto" } }}
            onChange={(event) => {
              const value = event.target.value;

              if (
                value === "ALL" ||
                value === "ACTIVE" ||
                value === "ARCHIVED"
              ) {
                setStatus(value);
              }
            }}
          >
            {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((value) => (
              <MenuItem key={value} value={value}>
                <Box
                  component="span"
                  sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
                >
                  {value === "ARCHIVED" ? (
                    <ArchiveOutlined fontSize="small" />
                  ) : value === "ACTIVE" ? (
                    <FolderOpenOutlined fontSize="small" />
                  ) : (
                    <EventOutlined fontSize="small" />
                  )}
                  {statusLabels[value]}
                </Box>
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Visibility"
            value={visibility}
            sx={{ minWidth: 0 }}
            onChange={(event) => {
              const value = event.target.value;

              if (
                value === "ALL" ||
                value === "PUBLIC" ||
                value === "PRIVATE"
              ) {
                setVisibility(value);
              }
            }}
          >
            {(["ALL", "PUBLIC", "PRIVATE"] as const).map((value) => (
              <MenuItem key={value} value={value}>
                <Box
                  component="span"
                  sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
                >
                  {value === "PUBLIC" ? (
                    <PublicOutlined fontSize="small" />
                  ) : value === "PRIVATE" ? (
                    <LinkOutlined fontSize="small" />
                  ) : (
                    <EventOutlined fontSize="small" />
                  )}
                  {labels[value]}
                </Box>
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Lifecycle"
            value={lifecycle}
            sx={{ minWidth: 0 }}
            onChange={(event) => {
              const value = event.target.value;

              if (
                value === "All" ||
                value === "Upcoming" ||
                value === "Ongoing" ||
                value === "Completed" ||
                value === "Cancelled"
              ) {
                setLifecycle(value);
              }
            }}
          >
            {lifecycleOptions.map(({ value, icon, color }) => (
              <MenuItem key={value} value={value}>
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1,
                    color,
                  }}
                >
                  {icon}
                  {value}
                </Box>
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Stack>
      {visibleEvents.length === 0 ? (
        <EmptyState
          icon={<EventOutlined />}
          title={
            events.length
              ? "No matching events"
              : "Your first event starts here"
          }
          description={
            events.length
              ? "Try another search or change the filters."
              : "Create a draft to set the schedule and registration details."
          }
          action={
            events.length ? (
              <Button
                onClick={() => {
                  setSearch("");
                  setStatus("ALL");
                  setVisibility("ALL");
                  setLifecycle("All");
                }}
              >
                Clear filters
              </Button>
            ) : status !== "ARCHIVED" ? (
              <CreateEventButton />
            ) : undefined
          }
        />
      ) : (
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            p: 0,
            m: 0,
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          {visibleEvents.map((event) => (
            <Paper
              component="li"
              variant="outlined"
              key={event.id}
              sx={{
                opacity: event.cancelledAt ? 0.5 : 1,
              }}
            >
              <CardActionArea
                href={`/dashboard/events/${event.id}`}
                aria-labelledby={`event-title-${event.id}`}
                sx={{
                  p: { xs: 2, sm: 3 },
                  height: "100%",
                  borderRadius: "inherit",
                }}
              >
                <Stack
                  spacing={2}
                  sx={{ height: "100%", alignItems: "flex-start" }}
                >
                  <Stack
                    direction="row"
                    sx={{
                      width: "100%",
                      gap: 1.5,
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ alignItems: "center", color: "text.secondary" }}
                    >
                      {event.visibility === "PUBLIC" ? (
                        <PublicOutlined sx={{ fontSize: 16 }} />
                      ) : (
                        <LinkOutlined sx={{ fontSize: 16 }} />
                      )}
                      <Typography variant="body2">
                        {labels[event.visibility]}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <EventLifecycleStatus event={event} now={now} />
                      <PublicationStatus state={publicationState(event)} />
                    </Stack>
                  </Stack>
                  <Typography
                    id={`event-title-${event.id}`}
                    component="h2"
                    variant="h6"
                    color="primary.main"
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {event.title}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }}>
                    <DateTime
                      date={event.startsAt}
                      endDate={event.endsAt}
                      timezone={event.timezone}
                    />
                  </Box>
                </Stack>
              </CardActionArea>
            </Paper>
          ))}
        </Box>
      )}
    </Stack>
  );
}
