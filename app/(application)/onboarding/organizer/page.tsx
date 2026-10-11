import { Button, Paper, Stack, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { becomeOrganizer } from "@/app/(application)/onboarding/organizer/actions";
import { AuthText } from "@/features/auth/components/auth-text";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export default async function OrganizerOnboardingPage() {
  const user = await requireVerifiedUser();
  const organizer = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (organizer) {
    redirect("/dashboard");
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 3, sm: 4 },
        maxWidth: 600,
        width: "100%",
        mx: "auto",
      }}
    >
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h4" component="h1">
            <AuthText id="becomeOrganizer" />
          </Typography>
          <Typography color="text.secondary">
            <AuthText id="onboardingDescription" />
          </Typography>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <form noValidate action={becomeOrganizer}>
            <Button type="submit" variant="contained">
              <AuthText id="becomeOrganizer" />
            </Button>
          </form>
          <Button href="/e">
            <AuthText id="browsePublicEvents" />
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
