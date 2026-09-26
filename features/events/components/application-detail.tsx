import { Alert, Divider, Link, Paper, Stack, Typography } from "@mui/material";
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
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2} sx={{ overflowWrap: "anywhere" }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
          >
            <Typography variant="h5" component="h3">
              {application.fullName}
            </Typography>
            <ApplicationStatus status={application.status} />
          </Stack>
          <Typography>{application.email}</Typography>
          <Typography variant="body2" color="text.secondary">
            Submitted {formatEventTime(application.createdAt, event.timezone)} (
            {event.timezone})
          </Typography>
          {application.reviewedAt && (
            <Typography variant="body2" color="text.secondary">
              Reviewed {formatEventTime(application.reviewedAt, event.timezone)}{" "}
              ({event.timezone})
            </Typography>
          )}
          <Divider />
          <ApplicationCapacity
            snapshot={event.publishedRevision?.snapshot}
            approved={event._count.applications}
          />
          {application.status === "PENDING" && (
            <ApplicationReviewControls
              eventId={id}
              applicationId={applicationId}
            />
          )}
        </Stack>
      </Paper>
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
          answers.map((answer) => (
            <Paper key={answer.fieldId} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1} sx={{ overflowWrap: "anywhere" }}>
                <Typography variant="subtitle1" component="h4">
                  {answer.label}
                </Typography>
                <Typography
                  sx={{ whiteSpace: "pre-wrap" }}
                  color={
                    answer.value === "Answer unavailable" ||
                    answer.value === "Not provided"
                      ? "text.secondary"
                      : "text.primary"
                  }
                >
                  {answer.value}
                </Typography>
              </Stack>
            </Paper>
          ))
        )}
      </Stack>
    </Stack>
  );

  return modal ? <ApplicationDialog>{content}</ApplicationDialog> : content;
}
