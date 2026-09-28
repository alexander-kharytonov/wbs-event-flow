import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { PageHeader } from "@/components/ui/page-header";
import { AccountNavigation } from "@/features/auth/components/account-navigation";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export default async function AccountPage() {
  const user = await requireVerifiedUser();
  const organizer = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  return (
    <Stack spacing={3}>
      <PageHeader title="My account" />
      <AccountNavigation active="overview" />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" },
          gap: 3,
        }}
      >
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack
            spacing={2}
            sx={{ alignItems: "flex-start", overflowWrap: "anywhere" }}
          >
            <Stack spacing={0.5}>
              <Typography variant="h6" component="h2">
                {user.name}
              </Typography>
              <Typography color="text.secondary">{user.email}</Typography>
            </Stack>
            <Typography color="text.secondary">
              Keep track of your applications and get ready for your next event.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button href="/account/registrations" variant="contained">
                View my registrations
              </Button>
              <Button href="/e">Explore events</Button>
            </Stack>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
            <Stack spacing={1}>
              <Typography variant="h6" component="h2">
                Organize events
              </Typography>
              <Typography color="text.secondary">
                Create and manage your own events on Event Flow.
              </Typography>
            </Stack>
            <Button
              href={organizer ? "/dashboard" : "/onboarding/organizer"}
              variant="outlined"
            >
              {organizer ? "Open organizer dashboard" : "Become an organizer"}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
