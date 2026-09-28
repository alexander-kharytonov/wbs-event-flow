import { Alert, Box, Link, Paper, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { ApplicationCapacity } from "@/features/events/components/application-capacity";
import { ApplicationDialog } from "@/features/events/components/application-dialog";
import { ApplicationReviewControls } from "@/features/events/components/application-review-controls";
import { ApplicationStatus } from "@/features/events/components/application-status";
import { EventHeader } from "@/features/events/components/event-header";
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
          />
          <Link
            href={`/dashboard/events/${id}/applications`}
            sx={{ alignSelf: "flex-start" }}
          >
            All applications
          </Link>
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
          <ApplicationStatus status={application.status} />
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
        {answers === null ? (
          <Alert severity="warning">Answer unavailable</Alert>
        ) : answers.length === 0 ? (
          <Typography color="text.secondary">
            There were no additional questions on this registration form.
          </Typography>
        ) : (
          <Box component="dl" sx={{ m: 0 }}>
            {answers.map((answer, index) => (
              <Box
                key={answer.fieldId}
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    sm: "minmax(0, 2fr) minmax(0, 3fr)",
                  },
                  columnGap: 3,
                  rowGap: 0.75,
                  py: 2,
                  borderTop: 1,
                  borderColor: "divider",
                  overflowWrap: "anywhere",
                }}
              >
                <Typography
                  component="dt"
                  variant="body2"
                  color="text.secondary"
                >
                  {index + 1}. {answer.label}
                </Typography>
                <Typography
                  component="dd"
                  sx={{ m: 0, whiteSpace: "pre-wrap" }}
                  color={
                    answer.value === "Answer unavailable" ||
                    answer.value === "Not provided"
                      ? "text.secondary"
                      : "text.primary"
                  }
                >
                  {answer.value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Stack>
      {application.status === "PENDING" && (
        <Paper
          variant="outlined"
          component="section"
          sx={{ p: { xs: 2, sm: 3 } }}
        >
          <Stack spacing={2}>
            <Typography variant="h6" component="h3">
              Review application
            </Typography>
            <ApplicationCapacity
              snapshot={event.publishedRevision?.snapshot}
              approved={event._count.applications}
            />
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
