import { Divider, Stack } from "@mui/material";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountAvatar } from "@/features/auth/components/account-avatar";
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
    <Stack spacing={4}>
      <AccountAvatar name={user.name} image={user.image} size={64} />
      <ProfileForm name={user.name} email={user.email} />
      <Divider />
      <GoogleAccount
        userId={user.id}
        accountId={google?.id}
        canDisconnect={canDisconnect}
        enabled={Boolean(getServerEnv().GOOGLE_CLIENT_ID)}
        error={typeof error === "string" ? error : undefined}
      />
    </Stack>
  );
}
