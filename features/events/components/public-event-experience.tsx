import "server-only";
import ArrowForward from "@mui/icons-material/ArrowForward";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { applicationPrefill } from "@/features/events/application-prefill";
import { applicationStatusLabels } from "@/features/events/application-status-labels";
import { ApplicationRealtime } from "@/features/events/components/application-realtime";
import { EventCover } from "@/features/events/components/event-cover";
import { EventGuestView } from "@/features/events/components/event-guest-view";
import { PublicEventCard } from "@/features/events/components/public-event-card";
import { RegistrationAdmission } from "@/features/events/components/registration-admission";
import { RegistrationApplicationForm } from "@/features/events/components/registration-application-form";
import { WithdrawApplicationButton } from "@/features/events/components/withdraw-application-button";
import { eventCoverImage } from "@/features/events/event-cover";
import { registrationAvailability } from "@/features/events/registration-availability";
import { getPublishedEvent } from "@/features/events/server/get-published-event";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function PublicEventExperience({
  publicId,
  registration = false,
}: {
  publicId: string;
  registration?: boolean;
}) {
  const {
    snapshot,
    eventRevisionId,
    cancelledAt,
    cancellationReason,
    lifecycleEndsAt,
  } = (await getPublishedEvent(publicId)) ?? notFound();
  const now = new Date();
  const occupied =
    !cancelledAt &&
    snapshot.capacity !== null &&
    now.getTime() < Date.parse(snapshot.endsAt)
      ? await prisma.attendee.count({
          where: { registration: { event: { publicId } }, revokedAt: null },
        })
      : undefined;
  const session = await getSession();
  const user = session?.user.emailVerified ? session.user : null;
  const ownedEvent = session
    ? await prisma.event.findFirst({
        where: { publicId, organizer: { userId: session.user.id } },
        select: { id: true },
      })
    : null;
  const application = user
    ? await prisma.application.findFirst({
        where: {
          userId: user.id,
          event: { publicId },
          status: { not: "WITHDRAWN" },
        },
        select: { id: true, status: true, eventId: true },
      })
    : null;
  const admission = user
    ? await prisma.registration.findFirst({
        where: { userId: user.id, event: { publicId }, revokedAt: null },
        select: { createdAt: true, revokedAt: true },
      })
    : null;
  const withdrawn =
    user && !application && !ownedEvent
      ? await prisma.application.findFirst({
          where: { userId: user.id, event: { publicId }, status: "WITHDRAWN" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            eventId: true,
            fullName: true,
            registrations: {
              where: { userId: user.id },
              select: { createdAt: true, revokedAt: true },
            },
            eventRevision: { select: { snapshot: true } },
            answers: {
              select: {
                fieldId: true,
                textValue: true,
                booleanValue: true,
                selectedOptions: { select: { optionId: true } },
              },
            },
          },
        })
      : null;
  const initialValues = withdrawn
    ? {
        fullName: [withdrawn.fullName],
        ...applicationPrefill(
          snapshot,
          withdrawn.eventRevision.snapshot,
          withdrawn.answers,
        ),
      }
    : undefined;
  const frozen = Boolean(cancelledAt || now >= lifecycleEndsAt);
  const open = !frozen && registrationAvailability(snapshot, now) === "OPEN";
  const returnQuery = new URLSearchParams({
    returnTo: `/e/${encodeURIComponent(publicId)}/register`,
  }).toString();

  const canApply = !ownedEvent && !application && open;
  const registrationHref = `/e/${publicId}/register`;
  const applicationLabel = withdrawn ? "Apply again" : "Register";
  const notice = (
    <>
      {user && (
        <ApplicationRealtime streamUrl="/api/account/registrations/stream" />
      )}
      {ownedEvent && (
        <Alert severity="info">
          <AlertTitle>This is your event</AlertTitle>
          You cannot apply to attend your own event.
        </Alert>
      )}
      {admission && (
        <RegistrationAdmission
          admission={admission}
          timezone={snapshot.timezone}
        />
      )}
      {application && !admission && (
        <Alert
          severity={
            application.status === "APPROVED"
              ? "info"
              : application.status === "REJECTED"
                ? "error"
                : "info"
          }
        >
          <AlertTitle>
            Your application: {applicationStatusLabels[application.status]}
          </AlertTitle>
          {frozen
            ? "Your application status is preserved as part of this event’s history."
            : application.status === "APPROVED"
              ? "Your application was approved. Admission details are unavailable."
              : application.status === "REJECTED"
                ? "Your application has been declined."
                : "Your application has been received and is awaiting organizer review."}
        </Alert>
      )}
      {!frozen &&
        application &&
        (application.status === "PENDING" ||
          application.status === "APPROVED") &&
        now.getTime() < Date.parse(snapshot.endsAt) && (
          <WithdrawApplicationButton
            publicId={publicId}
            applicationId={application.id}
          />
        )}
      {withdrawn?.registrations[0] && (
        <RegistrationAdmission
          admission={withdrawn.registrations[0]}
          timezone={snapshot.timezone}
        />
      )}
      {withdrawn && !frozen && (
        <Alert severity="info">
          <AlertTitle>Your application: Withdrawn</AlertTitle>
          {open
            ? "You can apply again. Only answers to unchanged questions carry over. Your new application will need organizer review."
            : "Your application has been withdrawn. You can apply again when registration is open."}
        </Alert>
      )}
      {user && (application || withdrawn) && (
        <Button
          href={`/account/registrations/${application?.eventId ?? withdrawn?.eventId}`}
        >
          View application history
        </Button>
      )}
    </>
  );

  if (registration) {
    const showForm =
      canApply && (snapshot.accountRequirement === "OPTIONAL" || Boolean(user));
    const eventContext = (
      <PublicEventCard
        publicId={publicId}
        snapshot={snapshot}
        now={now}
        component="section"
        showAvailability={
          !frozen && now.getTime() < Date.parse(snapshot.endsAt)
        }
      />
    );

    const registrationInfo = (
      <Stack spacing={2} useFlexGap sx={{ "&:empty": { display: "none" } }}>
        {cancelledAt ? (
          <Alert
            severity="error"
            sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            <AlertTitle>Event cancelled</AlertTitle>
            {cancellationReason}
          </Alert>
        ) : !open ? (
          <Alert severity="info">
            <AlertTitle>
              {registrationAvailability(snapshot, now) === "NOT_OPEN_YET" &&
              !frozen
                ? "Registration is not open yet"
                : "Registration is closed"}
            </AlertTitle>
            Return to the event for registration dates and details.
          </Alert>
        ) : snapshot.capacity !== null &&
          occupied !== undefined &&
          occupied >= snapshot.capacity ? (
          <Alert severity="info">
            All places are currently filled. You can still apply — a place may
            become available.
          </Alert>
        ) : null}
        {notice}
        {!ownedEvent &&
          open &&
          snapshot.accountRequirement === "REQUIRED" &&
          !user && (
            <Stack spacing={2}>
              <Alert severity="info">
                {session
                  ? "Verify your email before registering. Sign in to receive a verification link."
                  : "Sign in or create an account with a verified email to register for this event."}
              </Alert>
              <Typography variant="body2" color="text.secondary">
                You’ll return to registration after signing in or verifying your
                email.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button href={`/sign-in?${returnQuery}`} variant="contained">
                  Sign in
                </Button>
                <Button href={`/register?${returnQuery}`} variant="outlined">
                  Create account
                </Button>
              </Stack>
            </Stack>
          )}
      </Stack>
    );

    return (
      <Stack spacing={3} useFlexGap sx={{ minWidth: 0 }}>
        <BackLink href={`/e/${publicId}`}>Back to event</BackLink>
        <Stack spacing={1}>
          <Typography component="h1" variant="h4">
            {!canApply
              ? "Your registration"
              : withdrawn
                ? "Apply again"
                : "Register to attend"}
          </Typography>
        </Stack>
        {showForm ? (
          registrationInfo
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                md: "repeat(2, minmax(0, 1fr))",
              },
              gap: 3,
              alignItems: "stretch",
            }}
          >
            {eventContext}
            <Paper
              component="section"
              variant="outlined"
              aria-labelledby="registration-details-title"
              sx={{ p: { xs: 2.5, sm: 4 } }}
            >
              <Stack spacing={2}>
                <Typography
                  id="registration-details-title"
                  component="h2"
                  variant="h6"
                >
                  Registration details
                </Typography>
                {registrationInfo}
              </Stack>
            </Paper>
          </Box>
        )}

        {showForm && (
          <RegistrationApplicationForm
            key={`${publicId}:${user?.id ?? "anonymous"}:${withdrawn?.id ?? "new"}`}
            reapplication={Boolean(withdrawn)}
            eventContext={eventContext}
            initialValues={initialValues}
            publicId={publicId}
            eventRevisionId={eventRevisionId}
            fields={snapshot.registrationForm.fields}
            applicant={
              user ? { name: user.name, email: user.email } : undefined
            }
          />
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <BackLink href="/e">All events</BackLink>
      <EventGuestView
        cancelled={Boolean(cancelledAt)}
        cancellationReason={cancellationReason}
        snapshot={snapshot}
        now={now}
        occupied={occupied}
        cover={
          snapshot.cover && (
            <EventCover
              fill
              priority
              key={snapshot.cover.assetId}
              image={eventCoverImage(
                snapshot.cover,
                `/e/${publicId}/cover/${snapshot.cover.assetId}`,
              )}
            />
          )
        }
        showApplicationLink={canApply}
        applicationLinkHref={registrationHref}
        applicationLinkLabel={applicationLabel}
        notice={
          <>
            {canApply && (
              <Button
                href={registrationHref}
                variant="contained"
                fullWidth
                endIcon={<ArrowForward />}
              >
                {applicationLabel}
              </Button>
            )}
            {notice}
          </>
        }
      />
    </Stack>
  );
}
