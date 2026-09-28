import { Box, Button, Container, Link, Stack } from "@mui/material";
import { PrimaryNavigation } from "@/components/layout/primary-navigation";
import { Logo } from "@/components/ui/logo";
import { ThemeControl } from "@/components/ui/theme-control";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function ApplicationHeader() {
  const session = await getSession();
  const organizer = session
    ? await prisma.organizerProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
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
        Skip to content
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
              organizer={Boolean(organizer)}
            />
          </Box>
          <Stack
            direction="row"
            sx={{ alignItems: "center", gap: 0.5, ml: { xs: "auto", lg: 0 } }}
          >
            <ThemeControl />
            {session ? (
              <AccountMenu
                name={session.user.name}
                organizerProfileId={organizer?.id}
              />
            ) : (
              <Button href="/sign-in" variant="outlined">
                Sign in
              </Button>
            )}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
