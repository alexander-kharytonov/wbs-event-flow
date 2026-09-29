import ExpandMore from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DateTime } from "@/components/ui/date-time";
import { ApplicationRealtime } from "@/features/events/components/application-realtime";
import { ApplicationStatus } from "@/features/events/components/application-status";
import { RegistrationAdmission } from "@/features/events/components/registration-admission";
import { SubmittedAnswers } from "@/features/events/components/submitted-answers";
import { formatEventTime } from "@/features/events/format-event-time";
import { getMyRegistration } from "@/features/events/server/get-my-registration";
import { TicketCard } from "@/features/tickets/components/ticket-card";
import { requireVerifiedUser } from "@/lib/session";

type Attempt = NonNullable<
  Awaited<ReturnType<typeof getMyRegistration>>
>["current"];

export const metadata: Metadata = { title: "My registration | Event Flow" };

function AttemptDates({ attempt }: { attempt: Attempt }) {
  const timezone = attempt.context?.timezone ?? "UTC";

  return (
    <Box sx={{ bgcolor: "background.default", p: 2, borderRadius: 1 }}>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
          gap: 2,
          "& dt": { typography: "caption", color: "text.secondary" },
          "& dd": { m: 0, typography: "body2" },
        }}
      >
        <Box>
          <Typography component="dt">Submitted</Typography>
          <Typography component="dd">
            {formatEventTime(attempt.submittedAt, timezone)}
          </Typography>
        </Box>
        {attempt.reviewedAt && (
          <Box>
            <Typography component="dt">Reviewed</Typography>
            <Typography component="dd">
              {formatEventTime(attempt.reviewedAt, timezone)}
            </Typography>
          </Box>
        )}
        {attempt.status === "WITHDRAWN" && attempt.withdrawnAt && (
          <Box>
            <Typography component="dt">Withdrawn</Typography>
            <Typography component="dd">
              {formatEventTime(attempt.withdrawnAt, timezone)}
            </Typography>
          </Box>
        )}
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 1 }}
      >
        All times in {timezone}
      </Typography>
    </Box>
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
      <Box
        component="dl"
        sx={{
          m: 0,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 2,
          "& dt": { typography: "body2", color: "text.secondary" },
          "& dd": { m: 0, mt: 0.5 },
        }}
      >
        <Box>
          <Typography component="dt">Full name</Typography>
          <Typography component="dd">{attempt.fullName}</Typography>
        </Box>
        <Box>
          <Typography component="dt">Email</Typography>
          <Typography component="dd">{attempt.email}</Typography>
        </Box>
      </Box>
      <Typography variant="h6" component="h3">
        Submitted answers
      </Typography>
      <SubmittedAnswers answers={attempt.answers} />
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
      <Stack
        spacing={2}
        sx={{
          overflowWrap: "anywhere",
          pb: 3,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Link href="/account/registrations" sx={{ alignSelf: "flex-start" }}>
          ← All registrations
        </Link>
        <Typography variant="h4" component="h1">
          {context?.title ?? "Event details unavailable"}
        </Typography>
        {registration.cancelledAt && (
          <Alert severity="error" sx={{ whiteSpace: "pre-wrap" }}>
            Event cancelled. {registration.cancellationReason}
          </Alert>
        )}
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
      {current.admission?.ticket && (
        <TicketCard ticket={current.admission.ticket} />
      )}
      {current.admission && !current.admission.ticket && (
        <RegistrationAdmission
          admission={{
            createdAt: current.admission.createdAt,
            revokedAt: current.admission.revokedAt,
          }}
          timezone={context?.timezone ?? "UTC"}
        />
      )}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
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
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    sx={{ gap: 1.5, alignItems: { sm: "center" } }}
                  >
                    <ApplicationStatus status={attempt.status} />
                    <Typography variant="body2" color="text.secondary">
                      Submitted{" "}
                      {formatEventTime(
                        attempt.submittedAt,
                        attempt.context?.timezone ?? "UTC",
                      )}{" "}
                      ({attempt.context?.timezone ?? "UTC"})
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={3}>
                    {attempt.admission?.ticket && (
                      <TicketCard ticket={attempt.admission.ticket} />
                    )}
                    {attempt.admission && !attempt.admission.ticket && (
                      <RegistrationAdmission
                        admission={{
                          createdAt: attempt.admission.createdAt,
                          revokedAt: attempt.admission.revokedAt,
                        }}
                        timezone={attempt.context?.timezone ?? "UTC"}
                      />
                    )}
                    <AttemptDates attempt={attempt} />
                    <AttemptAnswers attempt={attempt} />
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </div>
        </Stack>
      )}
    </Stack>
  );
}
