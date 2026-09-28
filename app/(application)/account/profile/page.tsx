import { Paper, Stack } from "@mui/material";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { AccountNavigation } from "@/features/auth/components/account-navigation";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { requireVerifiedUser } from "@/lib/session";

export const metadata: Metadata = { title: "My profile | Event Flow" };

export default async function ProfilePage() {
  const user = await requireVerifiedUser();

  return (
    <Stack spacing={3}>
      <PageHeader title="My profile" />
      <AccountNavigation active="profile" />
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, maxWidth: 640 }}>
        <ProfileForm name={user.name} email={user.email} />
      </Paper>
    </Stack>
  );
}
