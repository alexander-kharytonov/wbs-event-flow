import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { AuthText } from "@/features/auth/components/auth-text";
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
      <Typography variant="h6" component="h2">
        <AuthText id="overview" />
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" },
          gap: 3,
        }}
      >
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
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
              <AuthText id="accountOverview" />
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button href="/account/registrations" variant="contained">
                <AuthText id="myRegistrations" />
              </Button>
              <Button href="/e">
                <AuthText id="exploreEvents" />
              </Button>
            </Stack>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
            <Stack spacing={1}>
              <Typography variant="h6" component="h2">
                <AuthText id="organizeEvents" />
              </Typography>
              <Typography color="text.secondary">
                <AuthText id="organizeDescription" />
              </Typography>
            </Stack>
            <Button
              href={organizer ? "/dashboard" : "/onboarding/organizer"}
              variant="outlined"
            >
              {organizer ? (
                <AuthText id="openDashboard" />
              ) : (
                <AuthText id="becomeOrganizer" />
              )}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
