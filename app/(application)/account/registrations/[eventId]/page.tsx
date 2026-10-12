import ExpandMore from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/ui/back-link";
import { DateTime, InlineDateTime } from "@/components/ui/date-time";
import { ApplicationRealtime } from "@/features/events/components/application-realtime";
import { ApplicationStatus } from "@/features/events/components/application-status";
import { EventText } from "@/features/events/components/event-text";
import { RegistrationAdmission } from "@/features/events/components/registration-admission";
import { SubmittedAnswers } from "@/features/events/components/submitted-answers";
import { SubmittedGuests } from "@/features/events/components/submitted-guests";
import { WithdrawApplicationButton } from "@/features/events/components/withdraw-application-button";
import { getMyRegistration } from "@/features/events/server/get-my-registration";
import { PartyGuests } from "@/features/guests/components/party-guests";
import {
  addLinkedGuest,
  removeLinkedGuest,
} from "@/features/guests/guest-actions";
import { TicketCard } from "@/features/tickets/components/ticket-card";
import { requireVerifiedUser } from "@/lib/session";

type Attempt = NonNullable<
  Awaited<ReturnType<typeof getMyRegistration>>
>["current"];

export async function generateMetadata() {
  const t = await getTranslations("events");

  return { title: `${t("myRegistration")} | Event Flow` };
}

function AttemptDates({ attempt }: { attempt: Attempt }) {
  const timezone = attempt.context?.timezone ?? "UTC";

  return (
    <Box sx={{ bgcolor: "background.default", p: 2, borderRadius: 1 }}>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
          gap: 2,
          "& dt": { typography: "caption", color: "text.secondary" },
          "& dd": { m: 0, typography: "body2" },
        }}
      >
        <Box>
          <Typography component="dt">
            <EventText id="applicationSubmittedLabel" />
          </Typography>
          <Typography component="dd">
            <InlineDateTime date={attempt.submittedAt} timezone={timezone} />
          </Typography>
        </Box>
        {attempt.reviewedAt && (
          <Box>
            <Typography component="dt">
              <EventText id="applicationReviewed" />
            </Typography>
            <Typography component="dd">
              <InlineDateTime date={attempt.reviewedAt} timezone={timezone} />
            </Typography>
          </Box>
        )}
        {attempt.status === "WITHDRAWN" && attempt.withdrawnAt && (
          <Box>
            <Typography component="dt">
              <EventText id="withdrawn" />
            </Typography>
            <Typography component="dd">
              <InlineDateTime date={attempt.withdrawnAt} timezone={timezone} />
            </Typography>
          </Box>
        )}
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 1 }}
      >
        <EventText id="allTimesIn" values={{ timezone }} />
      </Typography>
    </Box>
  );
}

function AttemptAnswers({ attempt }: { attempt: Attempt }) {
  return (
    <Stack spacing={2} sx={{ overflowWrap: "anywhere" }}>
      {attempt.context && (
        <Typography variant="body2" color="text.secondary">
          <EventText
            id="registrationsSubmittedFor"
            values={{ title: attempt.context.title }}
          />
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
          <Typography component="dt">
            <EventText id="fullName" />
          </Typography>
          <Typography component="dd">{attempt.fullName}</Typography>
        </Box>
        <Box>
          <Typography component="dt">
            <EventText id="email" />
          </Typography>
          <Typography component="dd">{attempt.email}</Typography>
        </Box>
      </Box>
      <Typography variant="h6" component="h3">
        <EventText id="applicationAnswers" />
      </Typography>
      <SubmittedAnswers answers={attempt.answers} />
      <SubmittedGuests guests={attempt.declaredGuests} />
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
        <BackLink href="/account/registrations">
          <EventText id="registrationsAll" />
        </BackLink>
        <Typography variant="h5" component="h2">
          {context?.title ?? <EventText id="registrationsDetailsUnavailable" />}
        </Typography>
        {registration.cancelledAt && (
          <Alert severity="error" sx={{ whiteSpace: "pre-wrap" }}>
            <EventText id="registrationsCancelled" />
            {registration.cancellationReason}
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
            <EventText
              id="registrationsHistorical"
              values={{ context: String(Boolean(context)) }}
            />
          </Alert>
        )}
        {registration.publicId && (
          <Button
            href={`/e/${encodeURIComponent(registration.publicId)}`}
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
          >
            <EventText id="viewEvent" />
          </Button>
        )}
      </Stack>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: current.admission ? "minmax(0, 1fr) 320px" : "minmax(0, 1fr)",
          },
          gap: 3,
          alignItems: "start",
        }}
      >
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
            >
              <Typography variant="h6" component="h2">
                <EventText id="registrationsCurrent" />
              </Typography>
              <ApplicationStatus status={current.status} />
              {registration.publicId &&
                !registration.completed &&
                !registration.cancelledAt &&
                context &&
                Date.now() < Date.parse(context.endsAt) &&
                (current.status === "PENDING" ||
                  current.status === "APPROVED") && (
                  <Box sx={{ ml: { sm: "auto" } }}>
                    <WithdrawApplicationButton
                      publicId={registration.publicId}
                      applicationId={current.id}
                    />
                  </Box>
                )}
            </Stack>
            <AttemptDates attempt={current} />
            <Typography variant="body2" color="text.secondary">
              <EventText id="applicationHistoricalHint" />
            </Typography>
            <Divider />
            <AttemptAnswers attempt={current} />
          </Stack>
        </Paper>
        {current.admission?.ticket && (
          <TicketCard ticket={current.admission.ticket} background="default" />
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
      </Box>
      {current.admission && (
        <PartyGuests
          party={current.admission.guests}
          addAction={addLinkedGuest.bind(null, current.admission.id)}
          removeAction={removeLinkedGuest.bind(null, current.admission.id)}
        />
      )}
      {previous.length > 0 && (
        <Stack
          component="section"
          aria-labelledby="previous-applications"
          spacing={2}
        >
          <Typography id="previous-applications" variant="h5" component="h2">
            <EventText id="registrationsPrevious" />
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
                      <EventText id="applicationSubmittedLabel" />{" "}
                      <InlineDateTime
                        date={attempt.submittedAt}
                        timezone={attempt.context?.timezone ?? "UTC"}
                      />{" "}
                      ({attempt.context?.timezone ?? "UTC"})
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "minmax(0, 1fr)",
                        md: attempt.admission
                          ? "minmax(0, 1fr) 320px"
                          : "minmax(0, 1fr)",
                      },
                      gap: 3,
                      alignItems: "start",
                    }}
                  >
                    <Stack spacing={3} sx={{ minWidth: 0 }}>
                      <AttemptDates attempt={attempt} />
                      <AttemptAnswers attempt={attempt} />
                    </Stack>
                    {attempt.admission?.ticket && (
                      <TicketCard
                        ticket={attempt.admission.ticket}
                        background="default"
                      />
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
                  </Box>
                  {attempt.admission && (
                    <Box sx={{ mt: 3 }}>
                      <PartyGuests
                        party={attempt.admission.guests}
                        addAction={addLinkedGuest.bind(
                          null,
                          attempt.admission.id,
                        )}
                        removeAction={removeLinkedGuest.bind(
                          null,
                          attempt.admission.id,
                        )}
                      />
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </div>
        </Stack>
      )}
    </Stack>
  );
}
