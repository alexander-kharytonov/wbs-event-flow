import { Alert, Button, Container, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { z } from "zod";
import { LanguageSelector } from "@/components/ui/language-selector";
import { ApplicationStatus } from "@/features/events/components/application-status";
import { EventText } from "@/features/events/components/event-text";
import { SubmittedAnswers } from "@/features/events/components/submitted-answers";
import { SubmittedGuests } from "@/features/events/components/submitted-guests";
import { WithdrawApplicationButton } from "@/features/events/components/withdraw-application-button";
import { applicationsFrozen } from "@/features/events/event-lifecycle";
import { historicalAnswers } from "@/features/events/historical-answers";
import { eventSnapshotSchema } from "@/features/events/schemas/event-snapshot";
import { authorizeApplication } from "@/features/events/server/application-access";
import { applicationGuestSelect } from "@/features/events/server/application-guests";
import { readApplicationSession } from "@/features/events/server/application-session";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function PrivateApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const capability = z.uuid().safeParse(applicationId).success
    ? await readApplicationSession(applicationId)
    : null;
  const application = capability
    ? await prisma.$transaction(
        async (tx) => {
          const access = await authorizeApplication(tx, capability);

          if (!access || access.id !== applicationId) {
            return null;
          }

          return tx.application.findUnique({
            where: { id: access.id },
            select: {
              id: true,
              fullName: true,
              email: true,
              status: true,
              eventRevision: { select: { snapshot: true } },
              answers: {
                select: {
                  fieldId: true,
                  textValue: true,
                  booleanValue: true,
                  selectedOptions: { select: { optionId: true } },
                },
              },
              guests: {
                select: applicationGuestSelect,
                orderBy: { position: "asc" },
              },
              event: {
                select: {
                  publicId: true,
                  startsAt: true,
                  endsAt: true,
                  cancelledAt: true,
                  archivedAt: true,
                  publishedRevision: { select: { snapshot: true } },
                },
              },
            },
          });
        },
        { isolationLevel: "RepeatableRead" },
      )
    : null;

  if (!application) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="info">
          <EventText id="applicationAccessUnavailable" />
        </Alert>
      </Container>
    );
  }
  const current = eventSnapshotSchema.safeParse(
    application.event.publishedRevision?.snapshot,
  );
  const submitted = eventSnapshotSchema.safeParse(
    application.eventRevision.snapshot,
  );
  const publicId = application.event.publicId;
  const canWithdraw =
    publicId &&
    current.success &&
    !applicationsFrozen(application.event, new Date()) &&
    Date.now() < Date.parse(current.data.endsAt) &&
    (application.status === "PENDING" || application.status === "APPROVED");

  return (
    <Container component="main" maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <Stack spacing={3} sx={{ overflowWrap: "anywhere" }}>
        <LanguageSelector />
        <Typography variant="h4" component="h1">
          <EventText id="yourApplication" />
        </Typography>
        {submitted.success && (
          <Typography variant="h5" component="h2">
            {submitted.data.title}
          </Typography>
        )}
        <Typography>{application.fullName}</Typography>
        <Typography color="text.secondary">{application.email}</Typography>
        <ApplicationStatus status={application.status} />
        <SubmittedAnswers
          answers={historicalAnswers(
            application.eventRevision.snapshot,
            application.answers,
          )}
        />
        <SubmittedGuests
          guests={application.guests.map((guest) => ({
            id: guest.id,
            name: guest.name,
            email: guest.email,
            answers: historicalAnswers(
              application.eventRevision.snapshot,
              guest.answers,
            ),
          }))}
        />
        {canWithdraw && (
          <WithdrawApplicationButton
            publicId={publicId}
            applicationId={application.id}
            anonymous
          />
        )}
        {publicId && current.success && (
          <Button href={`/e/${publicId}`}>
            <EventText id="viewEvent" />
          </Button>
        )}
      </Stack>
    </Container>
  );
}
