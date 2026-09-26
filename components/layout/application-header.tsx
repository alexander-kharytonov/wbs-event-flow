import { Box, Button, Container, Divider, Link, Stack } from "@mui/material";
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
      sx={{ borderBottom: 1, borderColor: "divider", py: 1.5 }}
    >
      <Container maxWidth="md">
        <Stack
          direction="row"
          useFlexGap
          sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}
        >
          <Link href="/" underline="none" color="inherit" variant="h6">
            Event Flow
          </Link>
          <Stack
            direction="row"
            useFlexGap
            sx={{ mx: "auto", flexWrap: "wrap", alignItems: "center" }}
          >
            <Button href="/e" color="inherit">
              Public events
            </Button>
          </Stack>
          <ThemeControl />
          <Divider
            orientation="vertical"
            sx={{ minHeight: 28, my: 1, display: { xs: "none", sm: "block" } }}
            flexItem
          />
          {session ? (
            <AccountMenu
              name={session.user.name}
              organizerProfileId={organizer?.id}
            />
          ) : (
            <Button href="/sign-in">Sign in</Button>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
