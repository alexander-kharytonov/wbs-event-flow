import InboxOutlined from "@mui/icons-material/InboxOutlined";
import {
  Avatar,
  Box,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { applicationStatusLabels } from "@/features/events/application-status-labels";
import { ApplicationCapacity } from "@/features/events/components/application-capacity";
import { ApplicationListItemButton } from "@/features/events/components/application-list-item-button";
import { ApplicationRealtime } from "@/features/events/components/application-realtime";
import { ApplicationStatus } from "@/features/events/components/application-status";
import { EventHeader } from "@/features/events/components/event-header";
import { formatEventTime } from "@/features/events/format-event-time";
import { getOwnedApplications } from "@/features/events/server/organizer-applications";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

export default async function ApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;
  const { status } = await searchParams;
  const event = await getOwnedApplications(organizer.id, id);

  if (!event) {
    notFound();
  }

  const filter =
    status === "PENDING" ||
    status === "APPROVED" ||
    status === "REJECTED" ||
    status === "WITHDRAWN"
      ? status
      : "ALL";
  const counts = {
    ALL: event.applications.length,
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
  };

  for (const application of event.applications) {
    counts[application.status] += 1;
  }

  const applications = event.applications.filter(
    (application) => filter === "ALL" || application.status === filter,
  );

  return (
    <Stack spacing={3}>
      <ApplicationRealtime
        streamUrl={`/api/events/${id}/applications/stream`}
      />
      <EventHeader
        eventId={id}
        event={event}
        active="applications"
        applicationCount={event.applications.length}
      />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          gap: 1,
          justifyContent: "space-between",
          alignItems: { sm: "baseline" },
        }}
      >
        <Typography variant="h6" component="h2">
          Applications
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {counts.PENDING} pending review · {counts.ALL} submitted attempts
        </Typography>
      </Stack>
      {event.publishedRevision && (
        <ApplicationCapacity
          snapshot={event.publishedRevision.snapshot}
          approved={counts.APPROVED}
        />
      )}
      <Stack
        component="nav"
        aria-label="Filter applications"
        direction="row"
        sx={{ flexWrap: "wrap", gap: 1 }}
      >
        {(["ALL", "PENDING", "APPROVED", "REJECTED", "WITHDRAWN"] as const).map(
          (value) => (
            <Button
              key={value}
              href={`/dashboard/events/${id}/applications${value === "ALL" ? "" : `?status=${value}`}`}
              variant={filter === value ? "contained" : "text"}
              color={filter === value ? "primary" : "inherit"}
              aria-current={filter === value ? "page" : undefined}
              aria-label={`${value === "ALL" ? "All" : applicationStatusLabels[value]} (${counts[value]})`}
              sx={{ px: 1.5 }}
            >
              {`${value === "ALL" ? "All" : applicationStatusLabels[value]} (${counts[value]})`}
            </Button>
          ),
        )}
      </Stack>
      {applications.length === 0 ? (
        <EmptyState
          icon={<InboxOutlined />}
          title={
            filter === "ALL"
              ? "No applications yet"
              : `No ${applicationStatusLabels[filter].toLowerCase()} applications`
          }
          description={
            filter === "ALL"
              ? "Submitted registrations will appear here for review."
              : "Applications with this status will appear here."
          }
          action={
            filter !== "ALL" ? (
              <Button href={`/dashboard/events/${id}/applications`}>
                View all applications
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Paper variant="outlined">
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

              return (
                <ListItem
                  key={application.id}
                  disablePadding
                  divider={index < applications.length - 1}
                >
                  <ApplicationListItemButton
                    href={`/dashboard/events/${id}/applications/${application.id}`}
                    fullName={application.fullName}
                  >
                    <ListItemAvatar sx={{ minWidth: 0, mt: 0.5 }}>
                      <Avatar
                        sx={{
                          bgcolor: "action.selected",
                          color: "primary.main",
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
                              {formatEventTime(
                                application.createdAt,
                                event.timezone,
                              )}{" "}
                              ({event.timezone})
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
