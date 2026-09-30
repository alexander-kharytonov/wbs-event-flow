import { Alert, Box, Paper, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { ApplicationDialog } from "@/features/events/components/application-dialog";
import { ApplicationReviewControls } from "@/features/events/components/application-review-controls";
import { ApplicationStatus } from "@/features/events/components/application-status";
import { EventCapacity } from "@/features/events/components/event-capacity";
import { EventHeader } from "@/features/events/components/event-header";
import { RegistrationAdmission } from "@/features/events/components/registration-admission";
import { SubmittedAnswers } from "@/features/events/components/submitted-answers";
import { applicationsFrozen } from "@/features/events/event-lifecycle";
import { formatEventTime } from "@/features/events/format-event-time";
import { historicalAnswers } from "@/features/events/historical-answers";
import { getOwnedApplication } from "@/features/events/server/organizer-applications";
import { requireOrganizer } from "@/features/organizer/server/require-organizer";

export async function ApplicationDetail({
  eventId: id,
  applicationId,
  modal = false,
}: {
  eventId: string;
  applicationId: string;
  modal?: boolean;
}) {
  const organizer = await requireOrganizer();
  const application = await getOwnedApplication(
    organizer.id,
    id,
    applicationId,
  );

  if (!application) {
    notFound();
  }

  const answers = historicalAnswers(
    application.eventRevision.snapshot,
    application.answers,
  );
  const { event } = application;

  const content = (
    <Stack spacing={3}>
      {!modal && (
        <>
          <EventHeader
            eventId={id}
            event={event}
            active="applications"
            applicationCount={event.applicationCount}
            attendeeCount={event.occupied}
          />
          <BackLink href={`/dashboard/events/${id}/applications`}>
            All applications
          </BackLink>
          <Typography variant="h4" component="h2">
            Application detail
          </Typography>
        </>
      )}
      <Stack spacing={2.5} sx={{ overflowWrap: "anywhere" }}>
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
              {application.fullName}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {application.email}
            </Typography>
          </Box>
          <Stack
            direction="row"
            useFlexGap
            spacing={1}
            sx={{
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: { xs: "flex-start", sm: "flex-end" },
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
        </Stack>
        <Box sx={{ bgcolor: "background.default", p: 2 }}>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, minmax(0, 1fr))",
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
            {[
              { label: "Submitted", date: application.createdAt },
              { label: "Reviewed", date: application.reviewedAt },
              { label: "Withdrawn", date: application.withdrawnAt },
            ]
              .filter(({ date }) => date !== null)
              .map(({ label, date }) => (
                <Box key={label}>
                  <Typography component="dt">{label}</Typography>
                  <Typography component="dd">
                    {date && formatEventTime(date, event.timezone)}
                  </Typography>
                </Box>
              ))}
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1.5 }}
          >
            All times in {event.timezone}
          </Typography>
        </Box>
      </Stack>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h6" component="h3">
            Submitted answers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Questions and options are shown as they were when this application
            was submitted.
          </Typography>
        </Stack>
        <SubmittedAnswers answers={answers} />
      </Stack>
      {applicationsFrozen(event, new Date()) && (
        <Alert severity="info">
          Application history is preserved. This event no longer accepts
          application changes.
        </Alert>
      )}
      {application.status === "PENDING" &&
        !event.archivedAt &&
        !applicationsFrozen(event, new Date()) && (
          <Paper
            variant="outlined"
            component="section"
            sx={{ p: { xs: 2, sm: 3 } }}
          >
            <Stack spacing={2}>
              <Typography variant="h6" component="h3">
                Review application
              </Typography>
              {(modal || !event.publishedRevision) && (
                <EventCapacity
                  snapshot={event.publishedRevision?.snapshot}
                  occupied={event.occupied}
                />
              )}
              <ApplicationReviewControls
                eventId={id}
                applicationId={applicationId}
              />
            </Stack>
          </Paper>
        )}
    </Stack>
  );

  return modal ? <ApplicationDialog>{content}</ApplicationDialog> : content;
}
