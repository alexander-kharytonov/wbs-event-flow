"use client";

import CancelOutlined from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import InboxOutlined from "@mui/icons-material/InboxOutlined";
import PendingOutlined from "@mui/icons-material/PendingOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import UndoOutlined from "@mui/icons-material/UndoOutlined";
import {
  Avatar,
  Box,
  Button,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { applicationStatusLabels } from "@/features/events/application-status-labels";
import { ApplicationListItemButton } from "@/features/events/components/application-list-item-button";
import { ApplicationStatus } from "@/features/events/components/application-status";
import { RegistrationAdmission } from "@/features/events/components/registration-admission";
import { formatEventTime } from "@/features/events/format-event-time";
import type { getEventApplications } from "@/features/events/server/organizer-applications";

type Applications = NonNullable<
  Awaited<ReturnType<typeof getEventApplications>>
>["applications"];
type StatusFilter = "ALL" | Applications[number]["status"];

export function ApplicationsList({
  eventId,
  applications: allApplications,
  timezone,
}: {
  eventId: string;
  applications: Applications;
  timezone: string;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const query = search.trim().toLowerCase();
  const applications = allApplications.filter(
    (application) =>
      (filter === "ALL" || application.status === filter) &&
      [application.fullName, application.email].some((value) =>
        value.toLowerCase().includes(query),
      ),
  );

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
          label="Search applications"
          placeholder="Name or email"
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
        <TextField
          select
          label="Status"
          value={filter}
          onChange={(event) => {
            const value = event.target.value;

            if (
              value === "ALL" ||
              value === "PENDING" ||
              value === "APPROVED" ||
              value === "REJECTED" ||
              value === "WITHDRAWN"
            ) {
              setFilter(value);
            }
          }}
          sx={{ minWidth: 0 }}
        >
          {(
            ["ALL", "PENDING", "APPROVED", "REJECTED", "WITHDRAWN"] as const
          ).map((value) => (
            <MenuItem key={value} value={value}>
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  color:
                    value === "APPROVED"
                      ? "success.main"
                      : value === "REJECTED"
                        ? "error.main"
                        : value === "PENDING"
                          ? "warning.main"
                          : "text.primary",
                }}
              >
                {value === "APPROVED" ? (
                  <CheckCircleOutlined fontSize="small" />
                ) : value === "REJECTED" ? (
                  <CancelOutlined fontSize="small" />
                ) : value === "PENDING" ? (
                  <PendingOutlined fontSize="small" />
                ) : value === "WITHDRAWN" ? (
                  <UndoOutlined fontSize="small" />
                ) : (
                  <InboxOutlined fontSize="small" />
                )}
                {value === "ALL" ? "All" : applicationStatusLabels[value]}
              </Box>
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {applications.length === 0 ? (
        <EmptyState
          icon={<InboxOutlined />}
          title={
            allApplications.length
              ? "No matching applications"
              : "No applications yet"
          }
          description={
            allApplications.length
              ? "Try another search or change the status filter."
              : "Submitted registrations will appear here for review."
          }
          action={
            allApplications.length ? (
              <Button
                onClick={() => {
                  setSearch("");
                  setFilter("ALL");
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <List disablePadding aria-label="Event applications">
            {applications.map((application, index) => {
              const nameParts = application.fullName
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
                  key={application.id}
                  disablePadding
                  divider={index < applications.length - 1}
                >
                  <ApplicationListItemButton
                    href={`/dashboard/events/${eventId}/applications/${application.id}`}
                    fullName={application.fullName}
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
                        primary={application.fullName}
                        secondary={
                          <>
                            <Typography
                              component="span"
                              variant="body2"
                              sx={{
                                display: "block",
                                color: "text.primary",
                                mt: 0.25,
                              }}
                            >
                              {application.email}
                            </Typography>
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{ display: "block", mt: 0.5 }}
                            >
                              Submitted{" "}
                              {formatEventTime(application.createdAt, timezone)}{" "}
                              ({timezone})
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
                        }}
                      >
                        <ApplicationStatus status={application.status} />
                        {application.registrations[0] && (
                          <RegistrationAdmission
                            admission={application.registrations[0]}
                            compact
                          />
                        )}
                      </Stack>
                    </Box>
                  </ApplicationListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Paper>
      )}
    </Stack>
  );
}
