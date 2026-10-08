import { Button, Paper, Stack, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { becomeOrganizer } from "@/app/(application)/onboarding/organizer/actions";
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
            Become an organizer
          </Typography>
          <Typography color="text.secondary">
            Create and manage events on Event Flow.
          </Typography>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <form noValidate action={becomeOrganizer}>
            <Button type="submit" variant="contained">
              Become an organizer
            </Button>
          </form>
          <Button href="/e">Browse public events</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
