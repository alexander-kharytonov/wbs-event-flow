import { Box, Container, Link, Stack } from "@mui/material";
import { PrimaryNavigation } from "@/components/layout/primary-navigation";
import { SignInLink } from "@/components/layout/sign-in-link";
import { LanguageSelector } from "@/components/ui/language-selector";
import { Logo } from "@/components/ui/logo";
import { ShellText } from "@/components/ui/shell-text";
import { ThemeControl } from "@/components/ui/theme-control";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUiPreferences } from "@/lib/ui-preferences";

export async function ApplicationHeader() {
  const [session, preferences] = await Promise.all([
    getSession(),
    getUiPreferences(),
  ]);
  const organizer = session
    ? await prisma.organizerProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
    : null;

  const assigned = session
    ? await prisma.eventStaff.findFirst({
        where: { userId: session.user.id },
        select: { eventId: true },
      })
    : null;

  return (
    <Box
      component="header"
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Link href="#main-content" className="skip-link">
        <ShellText id="skipContent" />
      </Link>
      <Container maxWidth="lg">
        <Stack
          direction="row"
          sx={{
            gap: { xs: 0.5, sm: 2 },
            alignItems: "center",
            minHeight: "calc(var(--application-header-height) - 1px)",
          }}
        >
          <Logo />
          <Box
            sx={{
              order: { xs: -1, lg: 0 },
              flexShrink: 0,
              mr: { lg: "auto" },
            }}
          >
            <PrimaryNavigation
              signedIn={Boolean(session)}
              organizer={Boolean(organizer || assigned)}
            />
          </Box>
          <Stack
            direction="row"
            sx={{ alignItems: "center", gap: 0.5, ml: { xs: "auto", lg: 0 } }}
          >
            <LanguageSelector />
            <ThemeControl initialMode={preferences.mode} />
            {session ? (
              <AccountMenu
                name={session.user.name}
                image={session.user.image}
                organizerProfileId={organizer?.id}
                hasAssignedEvents={Boolean(assigned)}
              />
            ) : (
              <SignInLink />
            )}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
