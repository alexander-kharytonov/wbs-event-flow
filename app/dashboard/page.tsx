import { Stack, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requireVerifiedUser();
  const organizer = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!organizer) {
    redirect("/onboarding/organizer");
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1">
        My events
      </Typography>
      <Typography color="text.secondary">
        You don’t have any events yet.
      </Typography>
    </Stack>
  );
}
