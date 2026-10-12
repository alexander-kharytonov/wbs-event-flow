import { EventText } from "@/features/events/components/event-text";
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
import { getRegistrationSelectPlaceholders } from "@/features/events/server/registration-select-placeholders";
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
  const applicationLabel = withdrawn ? (
    <EventText id="applyAgain" />
  ) : (
    <EventText id="register" />
  );
  const notice = (
    <>
      {user && (
        <ApplicationRealtime streamUrl="/api/account/registrations/stream" />
      )}
      {ownedEvent && (
        <Alert severity="info">
          <AlertTitle>
            <EventText id="ownEvent" />
          </AlertTitle>
          <EventText id="cannotApplyOwn" />
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
            <EventText
              id="yourApplication"
              values={{ status: application.status }}
            />
          </AlertTitle>
          {frozen ? (
            <EventText id="applicationPreserved" />
          ) : application.status === "APPROVED" ? (
            <EventText id="approvedAdmissionUnavailable" />
          ) : application.status === "REJECTED" ? (
            <EventText id="applicationDeclined" />
          ) : (
            <EventText id="applicationAwaitingReview" />
          )}
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
          <AlertTitle>
            <EventText id="yourApplication" values={{ status: "WITHDRAWN" }} />
          </AlertTitle>
          {open ? (
            <EventText id="reapplyNotice" />
          ) : (
            <EventText id="withdrawnRegistrationClosed" />
          )}
        </Alert>
      )}
      {user && (application || withdrawn) && (
        <Button
          href={`/account/registrations/${application?.eventId ?? withdrawn?.eventId}`}
        >
          <EventText id="viewApplicationHistory" />
        </Button>
      )}
    </>
  );

  if (registration) {
    const selectPlaceholders = await getRegistrationSelectPlaceholders(
      snapshot.language,
    );
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
            <AlertTitle>
              <EventText id="eventCancelled" />
            </AlertTitle>
            {cancellationReason}
          </Alert>
        ) : !open ? (
          <Alert severity="info">
            <AlertTitle>
              {registrationAvailability(snapshot, now) === "NOT_OPEN_YET" &&
              !frozen ? (
                <EventText id="notOpenRegistration" />
              ) : (
                <EventText id="closedRegistration" />
              )}
            </AlertTitle>
            <EventText id="returnForRegistrationDetails" />
          </Alert>
        ) : snapshot.capacity !== null &&
          occupied !== undefined &&
          occupied >= snapshot.capacity ? (
          <Alert severity="info">
            <EventText id="fullCanApply" />
          </Alert>
        ) : null}
        {notice}
        {!ownedEvent &&
          open &&
          snapshot.accountRequirement === "REQUIRED" &&
          !user && (
            <Stack spacing={2}>
              <Alert severity="info">
                {session ? (
                  <EventText id="verifyBeforeRegister" />
                ) : (
                  <EventText id="signInBeforeRegister" />
                )}
              </Alert>
              <Typography variant="body2" color="text.secondary">
                <EventText id="returnAfterSignIn" />
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button href={`/sign-in?${returnQuery}`} variant="contained">
                  <EventText id="signIn" />
                </Button>
                <Button href={`/register?${returnQuery}`} variant="outlined">
                  <EventText id="createAccount" />
                </Button>
              </Stack>
            </Stack>
          )}
      </Stack>
    );

    return (
      <Stack spacing={3} useFlexGap sx={{ minWidth: 0 }}>
        <BackLink href={`/e/${publicId}`}>
          <EventText id="backEvent" />
        </BackLink>
        <Stack spacing={1}>
          <Typography component="h1" variant="h4">
            {!canApply ? (
              <EventText id="yourRegistration" />
            ) : withdrawn ? (
              <EventText id="applyAgain" />
            ) : (
              <EventText id="registerToAttend" />
            )}
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
                  <EventText id="registrationDetails" />
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
            guestConfiguration={snapshot}
            selectPlaceholders={selectPlaceholders}
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
      <BackLink href="/e">
        <EventText id="allEvents" />
      </BackLink>
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
