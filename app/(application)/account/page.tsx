import ArrowForward from "@mui/icons-material/ArrowForward";
import EditOutlined from "@mui/icons-material/EditOutlined";
import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import EventNoteOutlined from "@mui/icons-material/EventNoteOutlined";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { AccountAvatar } from "@/features/auth/components/account-avatar";
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
      <Stack spacing={0.75}>
        <Typography variant="h5" component="h2">
          <AuthText id="overview" />
        </Typography>
        <Typography color="text.secondary">
          <AuthText id="accountOverview" />
        </Typography>
      </Stack>
      <Paper
        variant="outlined"
        sx={{ p: { xs: 2, sm: 3 }, bgcolor: "action.hover" }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ alignItems: { xs: "flex-start", sm: "center" } }}
        >
          <AccountAvatar name={user.name} image={user.image} size={56} />
          <Box sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
            <Typography variant="h6" component="h3">
              {user.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
          <Button
            href="/account/profile"
            variant="outlined"
            startIcon={<EditOutlined />}
          >
            <AuthText id="editProfile" />
          </Button>
        </Stack>
      </Paper>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, display: "flex" }}>
          <Stack spacing={2} sx={{ alignItems: "flex-start", width: "100%" }}>
            <EventAvailableOutlined
              sx={{ color: "primary.main", fontSize: 28 }}
            />
            <Stack spacing={0.75} sx={{ flex: 1 }}>
              <Typography variant="h6" component="h3">
                <AuthText id="participation" />
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <AuthText id="participationDescription" />
              </Typography>
            </Stack>
            <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
              <Button
                href="/account/registrations"
                variant="contained"
                endIcon={<ArrowForward />}
              >
                <AuthText id="myRegistrations" />
              </Button>
              <Button href="/e">
                <AuthText id="exploreEvents" />
              </Button>
            </Stack>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, display: "flex" }}>
          <Stack spacing={2} sx={{ alignItems: "flex-start", width: "100%" }}>
            <EventNoteOutlined sx={{ color: "primary.main", fontSize: 28 }} />
            <Stack spacing={0.75} sx={{ flex: 1 }}>
              <Typography variant="h6" component="h3">
                <AuthText id="organizeEvents" />
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <AuthText id="organizeDescription" />
              </Typography>
            </Stack>
            <Button
              href={organizer ? "/dashboard" : "/onboarding/organizer"}
              variant="outlined"
              endIcon={<ArrowForward />}
            >
              <AuthText id={organizer ? "openDashboard" : "becomeOrganizer"} />
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
