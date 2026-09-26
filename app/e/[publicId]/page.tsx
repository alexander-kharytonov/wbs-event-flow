import { Alert, Button, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EventGuestView } from "@/features/events/components/event-guest-view";
import { RegistrationApplicationForm } from "@/features/events/components/registration-application-form";
import { registrationAvailability } from "@/features/events/registration-availability";
import { getPublishedEvent } from "@/features/events/server/get-published-event";

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
  const { snapshot, eventRevisionId } = await publishedSnapshot(params);
  const { publicId } = await params;
  const now = new Date();
  const session = await getSession();
  const user = session?.user.emailVerified ? session.user : null;
  const open = registrationAvailability(snapshot, now) === "OPEN";
  const returnQuery = new URLSearchParams({
    returnTo: `/e/${encodeURIComponent(publicId)}`,
  }).toString();

  return (
    <EventGuestView snapshot={snapshot} now={now}>
      {open && (snapshot.accountRequirement === "OPTIONAL" || user) && (
        <RegistrationApplicationForm
          publicId={publicId}
          eventRevisionId={eventRevisionId}
          fields={snapshot.registrationForm.fields}
          applicant={user ? { name: user.name, email: user.email } : undefined}
        />
      )}
      {open && snapshot.accountRequirement === "REQUIRED" && !user && (
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
