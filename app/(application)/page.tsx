import { Alert, Button, Stack } from "@mui/material";
import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Event Flow — From planning to check-in",
  description:
    "Publish your event, build registration forms, review applications and welcome attendees with QR tickets, check-in, badges and team tools.",
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await getSession();
  const organizer = session
    ? await prisma.organizerProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
    : null;
  const { error } = await searchParams;

  const organizerHref = session
    ? organizer
      ? "/dashboard"
      : "/onboarding/organizer"
    : "/register?returnTo=%2Fonboarding%2Forganizer";

  return (
    <Stack spacing={3}>
      {error && (
        <Alert severity="error">
          The verification link is invalid or expired.{" "}
          <Button href="/verify-email">Request a new link</Button>
        </Alert>
      )}
      <LandingPage
        organizerHref={organizerHref}
        organizer={Boolean(organizer)}
        signedIn={Boolean(session)}
      />
    </Stack>
  );
}
