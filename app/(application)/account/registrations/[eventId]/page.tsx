import ExpandMore from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DateTime } from "@/components/ui/date-time";
import { AccountNavigation } from "@/features/auth/components/account-navigation";
import { ApplicationRealtime } from "@/features/events/components/application-realtime";
import { ApplicationStatus } from "@/features/events/components/application-status";
import { formatEventTime } from "@/features/events/format-event-time";
import { getMyRegistration } from "@/features/events/server/get-my-registration";
import { requireVerifiedUser } from "@/lib/session";

type Attempt = NonNullable<
  Awaited<ReturnType<typeof getMyRegistration>>
>["current"];

export const metadata: Metadata = { title: "My registration | Event Flow" };

function AttemptDates({ attempt }: { attempt: Attempt }) {
  const timezone = attempt.context?.timezone ?? "UTC";

  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" color="text.secondary">
        Submitted {formatEventTime(attempt.submittedAt, timezone)} ({timezone})
      </Typography>
      {attempt.reviewedAt && (
        <Typography variant="body2" color="text.secondary">
          Reviewed {formatEventTime(attempt.reviewedAt, timezone)} ({timezone})
        </Typography>
      )}
      {attempt.status === "WITHDRAWN" && attempt.withdrawnAt && (
        <Typography variant="body2" color="text.secondary">
          Withdrawn {formatEventTime(attempt.withdrawnAt, timezone)} ({timezone}
          )
        </Typography>
      )}
    </Stack>
  );
}

function AttemptAnswers({ attempt }: { attempt: Attempt }) {
  return (
    <Stack spacing={2} sx={{ overflowWrap: "anywhere" }}>
      {attempt.context && (
        <Typography variant="body2" color="text.secondary">
          Submitted for {attempt.context.title}
        </Typography>
      )}
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">Full name</Typography>
        <Typography>{attempt.fullName}</Typography>
      </Stack>
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">Email</Typography>
        <Typography>{attempt.email}</Typography>
      </Stack>
      <Divider />
      <Typography variant="subtitle2">Submitted answers</Typography>
      {attempt.answers === null ? (
        <Alert severity="warning">Answer unavailable</Alert>
      ) : attempt.answers.length === 0 ? (
        <Typography color="text.secondary">
          There were no additional questions on this registration form.
        </Typography>
      ) : (
        attempt.answers.map((answer) => (
          <Stack key={answer.fieldId} spacing={0.5}>
            <Typography variant="subtitle2">{answer.label}</Typography>
            <Typography sx={{ whiteSpace: "pre-wrap" }}>
              {answer.value}
            </Typography>
          </Stack>
        ))
      )}
    </Stack>
  );
}

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireVerifiedUser();
  const { eventId } = await params;
  const registration = await getMyRegistration(user.id, eventId);

  if (!registration) {
    notFound();
  }

  const { context, current, previous } = registration;

  return (
    <Stack spacing={3}>
      <ApplicationRealtime streamUrl="/api/account/registrations/stream" />
      <Typography variant="h4" component="h1">
        My registration
      </Typography>
      <AccountNavigation active="registrations" />
      <Button href="/account/registrations" sx={{ alignSelf: "flex-start" }}>
        All registrations
      </Button>
      <Stack spacing={1} sx={{ overflowWrap: "anywhere" }}>
        <Typography variant="h5" component="h2">
          {context?.title ?? "Event details unavailable"}
        </Typography>
        {context && (
          <DateTime
            date={context.startsAt}
            endDate={context.endsAt}
            timezone={context.timezone}
          />
        )}
        {registration.historicalContext && (
          <Alert severity="info">
            The current event page is unavailable. Your submitted application is
            preserved
            {context ? "; event details reflect its submitted version" : ""}.
          </Alert>
        )}
        {registration.publicId && (
          <Button
            href={`/e/${encodeURIComponent(registration.publicId)}`}
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
          >
            View event
          </Button>
        )}
      </Stack>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
          >
            <Typography variant="h6" component="h2">
              Current application
            </Typography>
            <ApplicationStatus status={current.status} />
          </Stack>
          <AttemptDates attempt={current} />
          <Typography variant="body2" color="text.secondary">
            Questions and options are shown as they were when this application
            was submitted.
          </Typography>
          <Divider />
          <AttemptAnswers attempt={current} />
        </Stack>
      </Paper>
      {previous.length > 0 && (
        <Stack
          component="section"
          aria-labelledby="previous-applications"
          spacing={2}
        >
          <Typography id="previous-applications" variant="h5" component="h2">
            Previous applications
          </Typography>
          <div>
            {previous.map((attempt, index) => (
              <Accordion
                key={attempt.id}
                disableGutters
                variant="outlined"
                elevation={0}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  id={`previous-application-${index}`}
                  aria-controls={`previous-application-details-${index}`}
                >
                  <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
                    <ApplicationStatus status={attempt.status} />
                    <AttemptDates attempt={attempt} />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <AttemptAnswers attempt={attempt} />
                </AccordionDetails>
              </Accordion>
            ))}
          </div>
        </Stack>
      )}
    </Stack>
  );
}
