import { Box, Paper, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountAvatar } from "@/features/auth/components/account-avatar";
import { AuthText } from "@/features/auth/components/auth-text";
import { GoogleAccount } from "@/features/auth/components/google-account";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");

  return { title: `${t("profile")} | Event Flow` };
}

export default async function ProfilePage({
  searchParams,
}: PageProps<"/account/profile">) {
  const user = await requireVerifiedUser();

  const { error } = await searchParams;
  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { id: true, providerId: true, password: true },
  });
  const google = accounts.find((account) => account.providerId === "google");
  const canDisconnect = accounts.some(
    (account) =>
      account.providerId === "credential" && Boolean(account.password),
  );

  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Typography variant="h5" component="h2">
          <AuthText id="profile" />
        </Typography>
        <Typography color="text.secondary">
          <AuthText id="profileDescription" />
        </Typography>
      </Stack>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 3 }}>
          <AccountAvatar name={user.name} image={user.image} size={56} />
          <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
            <Typography variant="subtitle1">{user.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
        </Stack>
        <ProfileForm name={user.name} email={user.email} />
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <GoogleAccount
          userId={user.id}
          accountId={google?.id}
          canDisconnect={canDisconnect}
          enabled={Boolean(getServerEnv().GOOGLE_CLIENT_ID)}
          error={typeof error === "string" ? error : undefined}
        />
      </Paper>
    </Stack>
  );
}
