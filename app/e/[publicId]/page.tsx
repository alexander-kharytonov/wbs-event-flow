import { Alert, AlertTitle, Button, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { applicationPrefill } from "@/features/events/application-prefill";
import { applicationStatusLabels } from "@/features/events/application-status-labels";
import { ApplicationRealtime } from "@/features/events/components/application-realtime";
import { EventGuestView } from "@/features/events/components/event-guest-view";
import { RegistrationAdmission } from "@/features/events/components/registration-admission";
import { RegistrationApplicationForm } from "@/features/events/components/registration-application-form";
import { WithdrawApplicationButton } from "@/features/events/components/withdraw-application-button";
import { registrationAvailability } from "@/features/events/registration-availability";
import { getPublishedEvent } from "@/features/events/server/get-published-event";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ publicId: string }> };

async function publishedSnapshot(params: Props["params"]) {
  await connection();
  const { publicId } = await params;
  const snapshot = await getPublishedEvent(publicId);

  if (!snapshot) {
    notFound();
  }

  return snapshot;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { snapshot } = await publishedSnapshot(params);

  return {
    title: `${snapshot.title} | Event Flow`,
    description:
      snapshot.description?.replace(/\s+/g, " ").trim().slice(0, 160) ||
      "Event details and registration information on Event Flow.",
    robots: {
      index: snapshot.visibility === "PUBLIC",
      follow: snapshot.visibility === "PUBLIC",
    },
  };
}

export default async function PublicEventPage({ params }: Props) {
  const {
    snapshot,
    eventRevisionId,
    cancelledAt,
    cancellationReason,
    lifecycleEndsAt,
  } = await publishedSnapshot(params);
  const { publicId } = await params;
  const now = new Date();
  const occupied =
    !cancelledAt &&
    snapshot.capacity !== null &&
    now.getTime() < Date.parse(snapshot.endsAt)
      ? await prisma.registration.count({
          where: { event: { publicId }, revokedAt: null },
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
    returnTo: `/e/${encodeURIComponent(publicId)}`,
  }).toString();

  return (
    <EventGuestView
      cancelled={Boolean(cancelledAt)}
      cancellationReason={cancellationReason}
      snapshot={snapshot}
      now={now}
      occupied={occupied}
      showApplicationLink={
        !ownedEvent &&
        !application &&
        open &&
        (snapshot.accountRequirement === "OPTIONAL" || Boolean(user))
      }
      notice={
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
          {user && (application || withdrawn) && (
            <Button
              href={`/account/registrations/${application?.eventId ?? withdrawn?.eventId}`}
              sx={{ alignSelf: "flex-start" }}
            >
              View application history
            </Button>
          )}
          {withdrawn && !frozen && (
            <Alert severity="info">
              <AlertTitle>Your application: Withdrawn</AlertTitle>
              {open
                ? "You can apply again below. Only answers to unchanged questions have been carried over. Your new application will need organizer review."
                : "Your application has been withdrawn. You can apply again when registration is open."}
            </Alert>
          )}
        </>
      }
    >
      {!ownedEvent &&
        !application &&
        open &&
        (snapshot.accountRequirement === "OPTIONAL" || user) && (
          <RegistrationApplicationForm
            key={`${eventRevisionId}:${withdrawn?.id ?? "new"}`}
            initialValues={initialValues}
            publicId={publicId}
            eventRevisionId={eventRevisionId}
            fields={snapshot.registrationForm.fields}
            applicant={
              user ? { name: user.name, email: user.email } : undefined
            }
          />
        )}
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
              You’ll return to this event after signing in or verifying your
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
    </EventGuestView>
  );
}
