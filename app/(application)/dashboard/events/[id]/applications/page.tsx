import InboxOutlined from "@mui/icons-material/InboxOutlined";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { ApplicationCapacity } from "@/features/events/components/application-capacity";
import { ApplicationDetailLink } from "@/features/events/components/application-detail-link";
import {
  ApplicationStatus,
  applicationStatusLabels,
} from "@/features/events/components/application-status";
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
    status === "PENDING" || status === "APPROVED" || status === "REJECTED"
      ? status
      : "ALL";
  const counts = {
    ALL: event.applications.length,
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  };

  for (const application of event.applications) {
    counts[application.status] += 1;
  }

  const applications = event.applications.filter(
    (application) => filter === "ALL" || application.status === filter,
  );

  return (
    <Stack spacing={3}>
      <EventHeader
        eventId={id}
        event={event}
        active="applications"
        applicationCount={event.applications.length}
      />
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
        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((value) => (
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
        ))}
      </Stack>
      {applications.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <InboxOutlined color="action" sx={{ fontSize: 36, mb: 1 }} />
          <Typography variant="h6" component="h3">
            {filter === "ALL"
              ? "No applications yet"
              : `No ${applicationStatusLabels[filter].toLowerCase()} applications`}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {filter === "ALL"
              ? "Submitted registrations will appear here for review."
              : "Applications with this status will appear here."}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {applications.map((application) => (
            <Paper key={application.id} variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                  justifyContent: "space-between",
                  alignItems: { sm: "center" },
                }}
              >
                <Stack
                  spacing={0.5}
                  sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                >
                  <ApplicationDetailLink
                    href={`/dashboard/events/${id}/applications/${application.id}`}
                    fullName={application.fullName}
                  />
                  <Typography variant="body2">{application.email}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Submitted{" "}
                    {formatEventTime(application.createdAt, event.timezone)} (
                    {event.timezone})
                  </Typography>
                </Stack>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <ApplicationStatus status={application.status} />
                  <ApplicationDetailLink
                    href={`/dashboard/events/${id}/applications/${application.id}`}
                    fullName={application.fullName}
                    button
                  />
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
