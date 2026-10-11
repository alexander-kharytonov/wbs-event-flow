import { Alert, Button, Stack } from "@mui/material";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthText } from "@/features/auth/components/auth-text";
import { LandingPage } from "@/features/landing/landing-page";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");

  return { title: t("metadataTitle"), description: t("metadataDescription") };
}

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
          <AuthText id="invalidLink" />{" "}
          <Button href="/verify-email">
            <AuthText id="requestNewLink" />
          </Button>
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
