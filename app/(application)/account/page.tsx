import { Button, Paper, Stack, Typography } from "@mui/material";
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
      <Typography variant="h4" component="h1">
        My account
      </Typography>
      <AccountNavigation active="overview" />
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 2 }}>
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
          <Button href="/e" variant="outlined">
            Browse public events
          </Button>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 2 }}>
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
            variant="contained"
          >
            {organizer ? "Open organizer dashboard" : "Become an organizer"}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
